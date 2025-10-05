import json
import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from collections import Counter

from sentence_transformers import SentenceTransformer
from sklearn.neighbors import NearestNeighbors
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import cosine_similarity

# Dataclass articles
@dataclass
class Article:
    id: str
    title: str
    abstract: str
    year: Optional[int] = None
    authors: Optional[List[str]] = field(default_factory=list)
    keywords: Optional[List[str]] = field(default_factory=list)


class ArticleSimilarityEngine:
    def __init__(
        self,
        model_name: str = "all-MiniLM-L6-v2",
        n_neighbors_default: int = 3,
        random_state: int = 42
    ):
        self.model_name = model_name
        self.model = SentenceTransformer(model_name)
        self.random_state = random_state
        self.n_neighbors_default = n_neighbors_default

        # Data
        self._articles: Dict[str, Article] = {}
        self._ids: List[str] = []
        self._embeddings: Optional[np.ndarray] = None

        # Indexs
        self._knn: Optional[NearestNeighbors] = None

        # Flags
        self._dirty = True

    # ------------- Util -------------
    def _ensure_index(self):
        """Reconstruct embeddings and KNN if had changes."""
        if not self._dirty:
            return
        if not self._ids:
            self._embeddings = None
            self._knn = None
            self._dirty = False
            return

        abstracts = [self._articles[i].abstract for i in self._ids]
        self._embeddings = self.model.encode(abstracts, show_progress_bar=False, normalize_embeddings=True)
        self._knn = NearestNeighbors(metric="cosine")
        self._knn.fit(self._embeddings)
        self._dirty = False

    # ------------- CRUD -------------
    def upsert_many(self, items: List[Dict]):
        """Items: [{id, title, abstract, year, authors, keywords}]"""
        for it in items:
            art = Article(
                id=str(it["id"]),
                title=it.get("title", f"Article {it['id']}"),
                abstract=it["abstract"],
                year=it.get("year"),
                authors=it.get("authors", []),
                keywords=it.get("keywords", []),
            )
            self._articles[art.id] = art
        self._ids = list(self._articles.keys())
        self._dirty = True

    def upsert_one(self, item: Dict):
        self.upsert_many([item])

    def all_articles(self) -> List[Dict]:
        return [self._as_public(self._articles[_id]) for _id in self._ids]

    def get_article(self, id: str) -> Optional[Dict]:
        if id in self._articles:
            return self._as_public(self._articles[id])
        return None

    def clear(self):
        self._articles.clear()
        self._ids = []
        self._embeddings = None
        self._knn = None
        self._dirty = False

    # ------------- Similiarity -------------
    def topk_by_text(self, text: str, k: Optional[int] = None) -> List[Dict]:
        self._ensure_index()
        if self._embeddings is None or self._knn is None:
            return []

        k = k or self.n_neighbors_default
        q = self.model.encode([text], show_progress_bar=False, normalize_embeddings=True)
        distances, idxs = self._knn.kneighbors(q, n_neighbors=min(k, len(self._ids)))
        d = distances[0]
        ids = [self._ids[i] for i in idxs[0]]
        # Cosine distance -> similarity
        sims = (1.0 - d).tolist()
        return [self._result_row(ids[i], sims[i]) for i in range(len(ids))]

    def topk_by_id(self, id_ref: str, k: Optional[int] = None) -> List[Dict]:
        self._ensure_index()
        if id_ref not in self._articles:
            return []
        if self._embeddings is None:
            return []

        k = k or self.n_neighbors_default
        idx = self._ids.index(id_ref)
        vec = self._embeddings[idx : idx + 1]
        distances, idxs = self._knn.kneighbors(vec, n_neighbors=min(k + 1, len(self._ids)))
        d = distances[0]
        id_list = [self._ids[i] for i in idxs[0]]

        rows = []
        for dist, _id in zip(d, id_list):
            if _id == id_ref:
                continue
            rows.append(self._result_row(_id, float(1.0 - dist)))
            if len(rows) >= k:
                break
        return rows

    def similarity_matrix(self, ids: Optional[List[str]] = None) -> Dict:
        """Returns NxN matrix for heatmap."""
        self._ensure_index()
        if self._embeddings is None:
            return {"ids": [], "matrix": []}

        sel_ids = ids if ids else self._ids
        sel_idx = [self._ids.index(i) for i in sel_ids if i in self._ids]
        if not sel_idx:
            return {"ids": [], "matrix": []}

        M = cosine_similarity(self._embeddings[sel_idx])
        return {"ids": [self._ids[i] for i in sel_idx], "matrix": M.tolist()}

    # ------------- Clusters -------------
    def projection(self, n_components: int = 2, ids: Optional[List[str]] = None) -> Dict:
        """2D PCA for scatter plot.
        Returns: [{id, x, y, title, year, cluster}]
        """
        self._ensure_index()
        if self._embeddings is None:
            return {"points": []}

        sel_ids = ids if ids else self._ids
        sel_idx = [self._ids.index(i) for i in sel_ids if i in self._ids]
        if not sel_idx:
            return {"points": []}

        X = self._embeddings[sel_idx]
        pca = PCA(n_components=n_components, random_state=self.random_state)
        XY = pca.fit_transform(X)

        points = []
        for i, _id in enumerate([self._ids[j] for j in sel_idx]):
            art = self._articles[_id]
            points.append({
                "id": _id,
                "x": float(XY[i, 0]),
                "y": float(XY[i, 1]),
                "title": art.title,
                "year": art.year,
                "authors": art.authors,
                "keywords": art.keywords
            })
        return {"points": points, "explained_variance": pca.explained_variance_ratio_.tolist()}

    def clusters(self, k: int = 5, ids: Optional[List[str]] = None) -> Dict:
        """KMeans about embeddings.
        Returns: labels per article + size of each cluster.
        """
        self._ensure_index()
        if self._embeddings is None:
            return {"labels": [], "clusters": []}

        sel_ids = ids if ids else self._ids
        sel_idx = [self._ids.index(i) for i in sel_ids if i in self._ids]
        if not sel_idx:
            return {"labels": [], "clusters": []}

        X = self._embeddings[sel_idx]
        k = max(1, min(k, X.shape[0]))
        kmeans = KMeans(n_clusters=k, n_init="auto", random_state=self.random_state)
        lab = kmeans.fit_predict(X).tolist()

        # Summary
        counts = {}
        for l in lab:
            counts[l] = counts.get(l, 0) + 1

        labels = [{"id": sel_ids[i], "cluster": int(lab[i])} for i in range(len(sel_ids))]
        clusters = [{"cluster": int(c), "size": int(n)} for c, n in counts.items()]
        clusters.sort(key=lambda x: x["size"], reverse=True)
        return {"labels": labels, "clusters": clusters}

    # ------------- Helpers -------------
    def _as_public(self, a: Article) -> Dict:
        return {
            "id": a.id,
            "title": a.title,
            "abstract": a.abstract,
            "year": a.year,
            "authors": a.authors,
            "keywords": a.keywords
        }

    def _result_row(self, _id: str, score: float) -> Dict:
        a = self._articles[_id]
        return {
            "id": _id,
            "title": a.title,
            "year": a.year,
            "score": float(score)
        }

    # ------------- Load data -------------
    def load_mock(self, path: str):
        with open(path, "r") as f:
            data = json.load(f)
        self.upsert_many(data)

    # ------------- Gap Analysis ----------

    def find_semantic_gaps(self, grid_size: int = 20, threshold: float = 0.05) -> List[Dict]:
        """
        Finds regions in semantic space (via PCA) with low density.

        Args:
            grid_size: Analysis grid resolution
            threshold: Minimum density to consider a gap (0-1)

        Returns:
            List of gaps ordered by potential, with nearby papers
        """
        self._ensure_index()
        if self._embeddings is None:
            return []

        # 2D Projection
        projection = self.projection(n_components=2)
        points = projection['points']

        if len(points) < 10:
            return []

        # Create grid
        xs = [p['x'] for p in points]
        ys = [p['y'] for p in points]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)

        x_bins = np.linspace(x_min, x_max, grid_size)
        y_bins = np.linspace(y_min, y_max, grid_size)

        # Count papers by cells
        grid = np.zeros((grid_size-1, grid_size-1))
        for p in points:
            xi = np.digitize(p['x'], x_bins) - 1
            yi = np.digitize(p['y'], y_bins) - 1
            if 0 <= xi < grid_size-1 and 0 <= yi < grid_size-1:
                grid[xi, yi] += 1

        # Normalize
        grid = grid / len(points)

        # Find gaps
        gaps = []
        for i in range(grid_size-1):
            for j in range(grid_size-1):
                if grid[i, j] < threshold:
                    cx = (x_bins[i] + x_bins[i+1]) / 2
                    cy = (y_bins[j] + y_bins[j+1]) / 2

                    distances = [np.sqrt((p['x']-cx)**2 + (p['y']-cy)**2) for p in points]
                    nearest_idx = np.argsort(distances)[:5]

                    gaps.append({
                        "x": float(cx),
                        "y": float(cy),
                        "density": float(grid[i, j]),
                        "nearest_papers": [
                            {
                                "id": points[idx]['id'],
                                "title": points[idx]['title'],
                                "distance": float(distances[idx])
                            }
                            for idx in nearest_idx
                        ],
                        "gap_score": float(1.0 - grid[i, j])
                    })

        # Sort by gap_score
        gaps.sort(key=lambda g: g['gap_score'], reverse=True)
        return gaps[:10]

    def underexplored_clusters(self, n_clusters: int = 15, min_size_threshold: float = 0.05) -> List[Dict]:
        """
        Identifies small clusters using KMeans over embeddings.

        Args:
            n_clusters: Number of clusters to create
            min_size_threshold: Minimum % of the corpus to consider "small"

        Returns:
            List of small clusters with their characteristics
        """
        self._ensure_index()
        if self._embeddings is None:
            return []

        cluster_result = self.clusters(k=n_clusters)

        # Analyze each cluster
        underexplored = []
        for c in cluster_result['clusters']:
            cluster_id = c['cluster']
            cluster_size = c['size']
            percentage = cluster_size / len(self._ids)

            # Only small clusters
            if percentage > min_size_threshold:
                continue

            # Get cluster papers
            paper_ids = [l['id'] for l in cluster_result['labels'] if l['cluster'] == cluster_id]
            papers = [self._articles[pid] for pid in paper_ids]

            # Basic stats
            years = [p.year for p in papers if p.year]
            keywords = [kw for p in papers for kw in p.keywords]

            top_kw = Counter(keywords).most_common(5)

            underexplored.append({
                "cluster": cluster_id,
                "size": cluster_size,
                "percentage": float(percentage * 100),
                "year_range": (min(years), max(years)) if years else None,
                "top_keywords": [k for k, _ in top_kw],
                "sample_papers": [
                    {"id": pid, "title": self._articles[pid].title}
                    for pid in paper_ids[:3]
                ],
                "exploration_score": float(1.0 / (cluster_size + 1))
            })

        # Sort by exploration_score
        underexplored.sort(key=lambda x: x['exploration_score'], reverse=True)
        return underexplored