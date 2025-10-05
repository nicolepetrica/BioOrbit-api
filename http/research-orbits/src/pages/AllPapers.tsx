// src/pages/AllPapers.tsx
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar.tsx";
import PaperCard from "./components/PaperCard";
import { loadPapers, type Paper } from "./lib/papers.ts";
import { useBookmarks } from "./hooks/useBookmarks.ts";

// graph
import CitationNetwork from "./components/CitationNetwork";
import { buildCitationGraph, type Graph } from "./lib/citationGraph.ts";

const CACHE_KEY = "citationGraph:v2";

export default function AllPapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const { isBookmarked, toggle } = useBookmarks();

  // graph state
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [graphErr, setGraphErr] = useState<string | null>(null);

  // load CSV
  useEffect(() => {
    (async () => setPapers(await loadPapers()))();
  }, []);

  // Build seed DOIs and titles map (ALL from CSV)
  const { seedDois, titlesByDoi } = useMemo(() => {
    const dois: string[] = [];
    const titles: Record<string, string> = {};
    for (const p of papers) {
      if (p.doi && p.doi.trim()) dois.push(p.doi.trim());
      if (p.doi && p.title) titles[p.doi.trim()] = p.title;
    }
    return { seedDois: Array.from(new Set(dois)), titlesByDoi: titles };
  }, [papers]);

  // Small signature so cache matches current set of DOIs
  const cacheSig = useMemo(
    () => seedDois.slice().sort().join("|"),
    [seedDois]
  );

  const tryLoadCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { sig, graph } = JSON.parse(raw);
      if (sig === cacheSig && graph?.nodes && graph?.links) return graph as Graph;
      return null;
    } catch {
      return null;
    }
  };

  const saveCache = (g: Graph) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ sig: cacheSig, graph: g }));
    } catch {
      // ignore quota / private mode issues
    }
  };

  // Build or load cached graph
  const buildOrLoad = async (force = false) => {
    if (!seedDois.length) {
      setGraph(null);
      setGraphErr(null);
      return;
    }
    try {
      setLoadingGraph(true);
      setGraphErr(null);

      if (!force) {
        const cached = tryLoadCache();
        if (cached) {
          setGraph(cached);
          return;
        }
      }

      const g = await buildCitationGraph({
        seedDois,
        titlesByDoi,
        maxDepth: 3,          // <= **requested depth**
        maxRefsPerNode: 30,   // trim per node
        delayMs: 140,         // be polite to Crossref
        // maxTotalNodes: 2500 // (optional safety)
      });

      setGraph(g);
      saveCache(g);
    } catch (e: any) {
      setGraphErr(e?.message || "Failed to build citation network");
    } finally {
      setLoadingGraph(false);
    }
  };

  useEffect(() => {
    buildOrLoad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheSig]); // rebuild when the set of DOIs changes

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />
      <section className="px-[40px] pt-10 pb-16">
        <div className="mx-auto max-w-[1800px]">
          <header className="flex items-center justify-between gap-4">
            <div className="text-center md:text-left w-full">
              <h1 className="font-extrabold tracking-tight text-[clamp(24px,4.8vw,56px)]">
                All Papers
              </h1>
              <p className="mx-auto md:mx-0 mt-4 max-w-[900px] text-white/80 text-[clamp(14px,1.3vw,18px)]">
                Browse everything from <code>papers_enriched.csv</code>. Use{" "}
                <strong>Bookmark</strong> to save items for this session.
              </p>
            </div>
            <button
              onClick={() => buildOrLoad(true)}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              title="Rebuild network (ignore cache)"
            >
              Rebuild network
            </button>
          </header>

          {/* ---- Citation Network ---- */}
          <div className="mt-8">
            {loadingGraph && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-white/70 text-center">
                Building citation network…
              </div>
            )}

            {graphErr && (
              <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-400/30 p-4 text-red-300 text-center">
                {graphErr}
              </div>
            )}

            {graph && !loadingGraph && !graphErr && (
              <>
                {/* make it large + zoomable (CitationNetwork already handles zoom) */}
                <CitationNetwork graph={graph} height="65vh" />
                <p className="mt-3 text-center text-white/60">
                  {graph.nodes.length} nodes • {graph.links.length} edges
                </p>
              </>
            )}
          </div>

          {/* ---- Cards ---- */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {papers.map((p) => (
              <PaperCard
                key={p.id}
                p={p}
                isSaved={isBookmarked(p.id)}
                onToggleSave={toggle}
              />
            ))}
            {papers.length === 0 && (
              <div className="text-white/70 text-center col-span-full">
                No rows found. Make sure <code>public/papers_enriched.csv</code> exists.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
