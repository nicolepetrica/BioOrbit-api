// src/lib/directGraph.ts
import { csvParse } from "d3-dsv";

export type DGNode = {
  id: string;          // DOI (normalized)
  label: string;       // Title if known, else DOI
  size: number;        // radius for rendering
  degreeIn: number;    // incoming edges (in-graph)
  isSaved?: boolean;   // bookmarked paper?
  index?: number;      // bookmark index (1-based) if saved
};

export type DGLink = {
  source: string;
  target: string;
  kind: "direct" | "cocite"; // direct = saved -> cited ; cocite = saved <-> saved (shared child)
};

export type DGGraph = { nodes: DGNode[]; links: DGLink[] };

const norm = (d: string) =>
  d?.trim()?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() ?? "";

/** Returns [parentKey, childKey] if CSV is edge-list. Otherwise null. */
function detectEdgeListKeys(headers: string[]): [string, string] | null {
  const H = headers.map((h) => h.toLowerCase().trim());
  const parentAliases = ["parent_doi", "source", "src", "seed_doi", "paper_doi", "from", "parent"];
  const childAliases  = ["child_doi", "target", "dst", "ref_doi", "cited_doi", "reference_doi", "to", "child"];

  const parentKey = headers.find((h, i) => parentAliases.includes(H[i]));
  const childKey  = headers.find((h, i) => childAliases.includes(H[i]));
  return parentKey && childKey ? [parentKey, childKey] : null;
}

function rowsToEdges(rows: Array<Record<string, string>>): Array<{source:string; target:string}> {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0] || {});
  const edges: Array<{source:string; target:string}> = [];

  // Edge-list?
  const edgeKeys = detectEdgeListKeys(headers);
  if (edgeKeys) {
    const [pk, ck] = edgeKeys;
    for (const r of rows) {
      const p = norm(r[pk] || "");
      const c = norm(r[ck] || "");
      if (p && c) edges.push({ source: p, target: c });
    }
    return edges;
  }

  // Wide: first column = parent, remaining columns = children (if present)
  const [firstKey, ...restKeys] = headers;
  for (const r of rows) {
    const p = norm(r[firstKey] || "");
    if (!p) continue;
    for (const k of restKeys) {
      const val = (r[k] || "").trim();
      if (!val) continue;
      const c = norm(val);
      if (c) edges.push({ source: p, target: c });
    }
  }
  return edges;
}

export async function buildDirectCitationGraph(opts: {
  savedDois: string[];                   // DOIs of bookmarked papers (raw)
  titlesByDoi: Record<string, string>;   // titles for saved (and any others you have)
  edgesUrl: string;                      // /citation_edges.csv
  savedIndexByDoi?: Record<string, number>; // bookmark index (optional, 1-based)
}): Promise<DGGraph> {
  const { savedDois, titlesByDoi, edgesUrl, savedIndexByDoi = {} } = opts;

  const saved = new Set(savedDois.map(norm));

  // Load CSV
  const resp = await fetch(edgesUrl, { cache: "force-cache" });
  if (!resp.ok) throw new Error(`Failed to load ${edgesUrl}: ${resp.status}`);
  const text = await resp.text();

  const rows = csvParse(text) as Array<Record<string, string>>;
  const allEdges = rowsToEdges(rows);

  const nodes = new Map<string, DGNode>();
  const links: DGLink[] = [];

  const ensureNode = (doiRaw: string, markSaved = false) => {
    const id = norm(doiRaw);
    if (!id) return null;
    let n = nodes.get(id);
    if (!n) {
      const label = titlesByDoi[id]?.trim() || id;
      n = {
        id,
        label,
        size: 10,
        degreeIn: 0,
        isSaved: markSaved || saved.has(id),
        index: savedIndexByDoi[id],
      };
      nodes.set(id, n);
    } else {
      if (markSaved) n.isSaved = true;
      if (savedIndexByDoi[id]) n.index = savedIndexByDoi[id];
    }
    return n;
  };

  // Ensure saved nodes exist (and hold their index)
  for (const d of saved) ensureNode(d, true);

  // Build direct edges only from saved -> their references
  // Also collect reverse map child -> set(saved that cite it) to add co-citation.
  const childToParents = new Map<string, Set<string>>();

  for (const e of allEdges) {
    const s = norm(e.source);
    const t = norm(e.target);
    if (!s || !t) continue;
    if (!saved.has(s)) continue;

    ensureNode(s, true);
    ensureNode(t, false);

    links.push({ source: s, target: t, kind: "direct" });

    if (!childToParents.has(t)) childToParents.set(t, new Set());
    childToParents.get(t)!.add(s);
  }

  // Add co-citation links between saved nodes that share a child
  const cociteKeySet = new Set<string>();
  for (const [, parents] of childToParents) {
    const arr = Array.from(parents);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (cociteKeySet.has(k)) continue;
        cociteKeySet.add(k);
        links.push({ source: a, target: b, kind: "cocite" });
      }
    }
  }

  // In-degree + size (saved are bigger)
  for (const { target } of links) {
    const t = nodes.get(target);
    if (t) t.degreeIn += 1;
  }
  for (const n of nodes.values()) {
    const base = 8 + Math.sqrt(n.degreeIn) * 6;
    const boost = n.isSaved ? 12 : 0; // << bigger “main” balls
    n.size = Math.max(10, Math.round(base + boost));
  }

  return { nodes: Array.from(nodes.values()), links };
}
