import { csvParse } from "d3-dsv";
import type { Graph, GraphNode, GraphLink } from "./citationGraph";

const norm = (s: string) =>
  s?.trim()?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() ?? "";

export async function loadCitationCSV(url = "/citation_edges.csv"): Promise<Graph> {
  const text = await fetch(url).then(r => {
    if (!r.ok) throw new Error("Failed to load citation_edges.csv");
    return r.text();
  });
  const rows = csvParse(text);

  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  for (const r of rows) {
    const src = norm(r.source as string);
    const tgt = norm(r.target as string);
    if (!src || !tgt) continue;
    links.push({ source: src, target: tgt });
    if (!nodes.has(src)) nodes.set(src, { id: src, label: src, size: 10, degreeIn: 0 });
    if (!nodes.has(tgt)) nodes.set(tgt, { id: tgt, label: tgt, size: 10, degreeIn: 0 });
  }

  // compute degrees and size
  for (const { target } of links) {
    const t = nodes.get(target);
    if (t) t.degreeIn += 1;
  }
  for (const n of nodes.values()) {
    n.size = Math.max(8, Math.round(8 + Math.sqrt(n.degreeIn) * 6));
  }

  return { nodes: Array.from(nodes.values()), links };
}
