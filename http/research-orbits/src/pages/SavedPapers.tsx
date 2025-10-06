import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import PaperCard from "./components/PaperCard";
import { loadPapers, type Paper } from "./lib/papers";
import { useBookmarks } from "./hooks/useBookmarks";
import { buildDirectCitationGraph, type DGGraph } from "./lib/directGraph";
import CitationNetworkSaved from "./components/CitationNetworkSaved";

export default function SavedPapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [graph, setGraph] = useState<DGGraph | null>(null);
  const [loading, setLoading] = useState(false);

  const { ids, isBookmarked, toggle, clearAll, getIndex } = useBookmarks();

  useEffect(() => {
    (async () => setPapers(await loadPapers()))();
  }, []);

  const savedList = useMemo(() => papers.filter((p) => ids.has(p.id)), [papers, ids]);

  // Only the DOIs drive the graph content
  const savedDois = useMemo(
    () =>
      savedList
        .map((p) => p.doi?.trim().toLowerCase())
        .filter((d): d is string => !!d && d.length > 0),
    [savedList]
  );

  // Title map (used for node labels). Changing titles doesn't require a graph recompute.
  const titlesByDoi = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of savedList) if (p.doi && p.title) m[p.doi.trim().toLowerCase()] = p.title;
    return m;
  }, [savedList]);

  // Optional index badges; these also shouldn't force a graph rebuild
  const savedIndexByDoi = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of savedList) if (p.doi) m[p.doi.trim().toLowerCase()] = getIndex(p.id) ?? 0;
    return m;
  }, [savedList, getIndex]);

  // Stable signature: only depends on the set of DOIs (sort to normalize)
  const graphSig = useMemo(() => savedDois.slice().sort().join("|"), [savedDois]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!savedDois.length) {
        setGraph(null);
        return;
      }
      try {
        setLoading(true);
        const g = await buildDirectCitationGraph({
          savedDois,
          titlesByDoi,
          edgesUrl: "/citation_edges.csv",
          savedIndexByDoi,
        });
        if (!cancelled) setGraph(g);
      } catch (e) {
        if (!cancelled) setGraph(null);
        console.error("Graph build failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // 🚨 Only depend on the signature, not on titles/index maps
  }, [graphSig]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />
      <section className="relative px-[40px] pt-10 pb-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[#0c0814]" />
        <div className="relative z-10 mx-auto max-w-[1800px]">
          <header className="flex items-end justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl xl:text-[56px]">
                Saved Papers
              </h1>
              <p className="mt-2 text-base text-white/80 lg:text-lg xl:text-[18px]">
                Direct citations from your bookmarks. Shared references connect saved papers together.
              </p>
            </div>
            {savedList.length > 0 && (
              <button
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                onClick={clearAll}
              >
                Clear all
              </button>
            )}
          </header>

          {/* Graph at top */}
          <div className="mt-8">
            {loading && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-center text-white/70">
                Building…
              </div>
            )}
            {graph && !loading && <CitationNetworkSaved graph={graph} height="55vh" />}
            {!graph && !loading && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-center text-white/70">
                Bookmark a few papers to see their citation network.
              </div>
            )}
          </div>

          {/* Cards */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedList.map((p) => (
              <PaperCard
                key={p.id}
                p={p}
                isSaved={isBookmarked(p.id)}
                onToggleSave={() => toggle(p.id)}
                index={savedIndexByDoi[p.doi?.trim().toLowerCase() || ""] || 0}
              />
            ))}
            {savedList.length === 0 && (
              <div className="text-white/70 text-center w-full">
                You haven’t bookmarked anything yet. Go to <strong>All Papers</strong> and press “Bookmark”.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
