// src/lib/citationGraph.ts
export type GraphNode = {
  id: string;     // normalized DOI
  label: string;  // title (CSV preferred; Crossref fallback)
  size: number;   // node radius in px
  degreeIn: number;
};

export type GraphLink = { source: string; target: string };
export type Graph = { nodes: GraphNode[]; links: GraphLink[] };

// ---------- helpers ----------
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const normDoi = (doi: string) =>
  doi
    ?.trim()
    ?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    ?.toLowerCase() ?? "";

// Polite Crossref fetch
async function crossrefWork(doi: string) {
  const safe = encodeURIComponent(normDoi(doi));
  const url = `https://api.crossref.org/works/${safe}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Crossref ${resp.status} for ${doi}`);
  return resp.json();
}

// ---------- builder ----------
/**
 * Breadth-first citation graph.
 * - seedDois: starting DOIs (we’ll add edges seed -> its references)
 * - titlesByDoi: map of DOI -> title (CSV preferred labels)
 * - maxDepth: number of reference hops (3 = seeds + refs + refs^2 + refs^3)
 * - maxRefsPerNode: trim refs per node to keep things tractable
 * - maxTotalNodes: optional global cap
 * - delayMs: throttle between Crossref requests
 */
export async function buildCitationGraph(opts: {
  seedDois: string[];
  titlesByDoi: Record<string, string>;
  maxDepth?: number;
  maxRefsPerNode?: number;
  maxTotalNodes?: number;
  delayMs?: number;
}): Promise<Graph> {
  const {
    seedDois,
    titlesByDoi,
    maxDepth = 3,
    maxRefsPerNode = 30,
    maxTotalNodes,
    delayMs = 120,
  } = opts;

  // Normalize title keys
  const titlesNorm: Record<string, string> = {};
  for (const [k, v] of Object.entries(titlesByDoi || {})) {
    titlesNorm[normDoi(k)] = v;
  }

  const nodes = new Map<string, GraphNode>();
  const linkKeySet = new Set<string>();
  const links: GraphLink[] = [];
  const queued = new Set<string>();   // visited/queued for BFS (avoid refetch)
  const fetchQueue: Array<{ doi: string; depth: number }> = [];

  const ensureNode = (raw: string, titleX?: string) => {
    const id = normDoi(raw);
    if (!id) return null;
    let n = nodes.get(id);
    if (!n) {
      const label = titlesNorm[id]?.trim() || titleX?.trim() || id;
      n = { id, label, size: 10, degreeIn: 0 };
      nodes.set(id, n);
    }
    return n;
  };

  // Seed the queue with ALL DOIs from your CSV
  for (const d of seedDois.map(normDoi).filter(Boolean)) {
    if (!queued.has(d)) {
      queued.add(d);
      fetchQueue.push({ doi: d, depth: 0 });
      ensureNode(d);
    }
  }

  while (fetchQueue.length > 0) {
    const { doi, depth } = fetchQueue.shift()!;

    try {
      const data = await crossrefWork(doi);
      const titleCR = data?.message?.title?.[0] as string | undefined;
      ensureNode(doi, titleCR);

      const refs = (data?.message?.reference || []) as Array<any>;
      if (Array.isArray(refs) && refs.length) {
        let added = 0;
        for (const r of refs) {
          if (!r?.DOI) continue;
          const rDoi = normDoi(String(r.DOI));
          if (!rDoi) continue;

          ensureNode(rDoi);

          const key = `${doi}|${rDoi}`;
          if (!linkKeySet.has(key)) {
            linkKeySet.add(key);
            links.push({ source: doi, target: rDoi });
            added++;

            // BFS expansion if we still have depth budget
            if (depth < maxDepth) {
              if (!queued.has(rDoi)) {
                queued.add(rDoi);
                fetchQueue.push({ doi: rDoi, depth: depth + 1 });
              }
            }

            if (added >= maxRefsPerNode) break;
          }
        }
      }
    } catch (err) {
      // Non-fatal; keep crawling others
      console.warn("Crossref fetch failed:", doi, err);
    }

    // Optional global cap to avoid runaway graphs
    if (typeof maxTotalNodes === "number" && nodes.size >= maxTotalNodes) break;

    await sleep(delayMs);
  }

  // In-degree and bubble size
  for (const { target } of links) {
    const t = nodes.get(target);
    if (t) t.degreeIn += 1;
  }
  for (const n of nodes.values()) {
    n.size = Math.max(8, Math.round(8 + Math.sqrt(n.degreeIn) * 6));
  }

  return { nodes: Array.from(nodes.values()), links };
}
