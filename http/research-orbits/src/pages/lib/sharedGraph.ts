// src/lib/sharedGraph.ts
import { csvParse } from "d3-dsv";

export type SGNode = {
  id: string;        // normalized DOI of a paper in your CSV
  label: string;     // title from your CSV
  size: number;      // derived from in-degree + shared weight
  inDirect: number;  // direct incoming citations from seed set
  sharedDeg: number; // total shared-citation weight
};

export type SGLink = {
  source: string;    // DOI (normalized)
  target: string;    // DOI (normalized)
  kind: "direct" | "shared";
  weight?: number;   // for "shared" edges (count of shared refs)
};

export type SGGraph = { nodes: SGNode[]; links: SGLink[] };

const norm = (s: string) =>
  s?.trim()?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() ?? "";

async function loadEdges(url = "/citation_edges.csv") {
  const txt = await fetch(url).then(r => {
    if (!r.ok) throw new Error("Failed to load citation_edges.csv");
    return r.text();
  });
  const rows = csvParse(txt) as Array<Record<string, string>>;
  const edges: Array<{ source: string; target: string }> = [];
  for (const r of rows) {
    const s = norm(r.source || (r as any).Source || "");
    const t = norm(r.target || (r as any).Target || "");
    if (s && t) edges.push({ source: s, target: t });
  }
  return edges;
}

/**
 * Build a compact graph among your CSV papers:
 * - Nodes: only DOIs present in seedDois (your CSV set)
 * - Links:
 *   - kind:"direct" when both source & target are in seed set
 *   - kind:"shared" between two seed papers when they share >= minShared common refs
 */
export async function buildSharedCitationGraph(opts: {
  seedDois: string[];
  titlesByDoi: Record<string, string>;
  edgesUrl?: string;
  minShared?: number;     // default 1 (at least one shared ref)
  maxNodes?: number;      // optional cap for rendering
}): Promise<SGGraph> {
  const { edgesUrl = "/citation_edges.csv", minShared = 1, maxNodes } = opts;

  // normalize seeds & titles
  const seedSet = new Set(opts.seedDois.map(norm).filter(Boolean));
  const titleMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.titlesByDoi || {})) titleMap[norm(k)] = v || norm(k);

  // load all crawled edges (seed → reference)
  const edges = await loadEdges(edgesUrl);

  // per-seed reference sets, and internal direct edges
  const refsBySeed = new Map<string, Set<string>>();
  const directEdges: SGLink[] = [];

  for (const { source, target } of edges) {
    if (seedSet.has(source)) {
      // collect refs for source
      if (!refsBySeed.has(source)) refsBySeed.set(source, new Set<string>());
      refsBySeed.get(source)!.add(target);

      // direct citation (both in seed set)
      if (seedSet.has(target)) {
        directEdges.push({ source, target, kind: "direct" });
      }
    }
  }

  // shared-citation (co-citation): build edges where two seeds share references
  const seeds = Array.from(seedSet);
  const sharedEdges: SGLink[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const a = seeds[i];
    const A = refsBySeed.get(a);
    if (!A || A.size === 0) continue;

    for (let j = i + 1; j < seeds.length; j++) {
      const b = seeds[j];
      const B = refsBySeed.get(b);
      if (!B || B.size === 0) continue;

      // compute intersection size quickly
      let shared = 0;
      for (const r of A) if (B.has(r)) shared++;
      if (shared >= minShared) {
        sharedEdges.push({ source: a, target: b, kind: "shared", weight: shared });
      }
    }
  }

  // nodes map (seed only), compute degrees
  const nodes = new Map<string, SGNode>();
  for (const id of seedSet) {
    nodes.set(id, {
      id,
      label: titleMap[id] || id,
      size: 10,
      inDirect: 0,
      sharedDeg: 0,
    });
  }

  // in-degree for direct edges
  for (const e of directEdges) {
    const t = nodes.get(e.target);
    if (t) t.inDirect += 1;
  }

  // accumulate shared weights per node
  for (const e of sharedEdges) {
    const a = nodes.get(e.source);
    const b = nodes.get(e.target);
    const w = e.weight || 1;
    if (a) a.sharedDeg += w;
    if (b) b.sharedDeg += w;
  }

  // size scaling: emphasize direct citations + shared weight
  for (const n of nodes.values()) {
    const score = n.inDirect * 2 + Math.sqrt(n.sharedDeg);
    n.size = Math.max(8, Math.round(10 + score * 4));
  }

  // optionally keep top-N by size to avoid huge renders
  let nodeArr = Array.from(nodes.values());
  if (typeof maxNodes === "number" && nodeArr.length > maxNodes) {
    nodeArr = nodeArr.sort((a, b) => b.size - a.size).slice(0, maxNodes);
  }
  const nodeSetKept = new Set(nodeArr.map((n) => n.id));

  // keep only links touching kept nodes
  const links = [...directEdges, ...sharedEdges].filter(
    (e) => nodeSetKept.has(e.source) && nodeSetKept.has(e.target)
  );

  return { nodes: nodeArr, links };
}
