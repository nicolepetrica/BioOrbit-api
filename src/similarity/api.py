from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from knn import ArticleSimilarityEngine

app = FastAPI(title="Article Similarity API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = ArticleSimilarityEngine()

# --- Schemas ---
class ArticleIn(BaseModel):
    id: str
    title: str
    abstract: str
    year: Optional[int] = None
    authors: Optional[List[str]] = []
    keywords: Optional[List[str]] = []

class TopKTextReq(BaseModel):
    text: str
    k: Optional[int] = 5

class TopKIdReq(BaseModel):
    id: str
    k: Optional[int] = 5

class MatrixReq(BaseModel):
    ids: Optional[List[str]] = None

class ProjectionReq(BaseModel):
    ids: Optional[List[str]] = None
    n_components: int = 2

class ClustersReq(BaseModel):
    ids: Optional[List[str]] = None
    k: int = 5

class SemanticGapsReq(BaseModel):
    grid_size: int = 20
    threshold: float = 0.05

class UnderexploredReq(BaseModel):
    n_clusters: int = 15
    min_size_threshold: float = 0.05

# --- Routes ---
@app.get("/health")
def health():
    return {
        "status": "ok",
        "count": len(engine._ids),
        "model": engine.model_name,
        "features": [
            "topk",
            "matrix",
            "projection",
            "clusters",
            "semantic_gaps",
            "underexplored_clusters"
        ]
    }

@app.post("/articles/upsert")
def upsert_article(a: ArticleIn):
    try:
        engine.upsert_one(a.dict())
        return {"message": f"upsert ok", "count": len(engine._ids)}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/articles/upsert_many")
def upsert_many(items: List[ArticleIn]):
    try:
        engine.upsert_many([x.dict() for x in items])
        return {"message": "upsert many ok", "count": len(engine._ids)}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/articles/all")
def all_articles():
    return {"items": engine.all_articles()}

@app.get("/articles/{article_id}")
def get_article(article_id: str):
    try:
        article = engine.get_article(article_id)
        if article is None:
            raise HTTPException(404, f"Article {article_id} not found")
        return article
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/similarity/topk_text")
def topk_by_text(req: TopKTextReq):
    try:
        return {"results": engine.topk_by_text(req.text, k=req.k)}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/similarity/topk_id")
def topk_by_id(req: TopKIdReq):
    try:
        return {"results": engine.topk_by_id(req.id, k=req.k)}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/similarity/matrix")
def matrix(req: MatrixReq):
    try:
        return engine.similarity_matrix(req.ids)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/viz/projection")
def projection(req: ProjectionReq):
    try:
        return engine.projection(n_components=req.n_components, ids=req.ids)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/viz/clusters")
def clusters(req: ClustersReq):
    try:
        return engine.clusters(k=req.k, ids=req.ids)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/analysis/semantic_gaps")
def semantic_gaps(req: SemanticGapsReq):
    try:
        gaps = engine.find_semantic_gaps(
            grid_size=req.grid_size,
            threshold=req.threshold
        )
        return {
            "gaps": gaps,
            "total_found": len(gaps),
            "description": "Semantic gaps represent unexplored areas between existing topics"
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/analysis/underexplored_clusters")
def underexplored_clusters(req: UnderexploredReq):
    try:
        clusters = engine.underexplored_clusters(
            n_clusters=req.n_clusters,
            min_size_threshold=req.min_size_threshold
        )
        return {
            "underexplored": clusters,
            "total_found": len(clusters),
            "description": "Underexplored clusters are existing topics with few papers"
        }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/clear")
def clear():
    engine.clear()
    return {"message": "cleared"}
