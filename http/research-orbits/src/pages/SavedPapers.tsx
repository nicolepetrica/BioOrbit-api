// src/pages/SavedPapers.tsx
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

  useEffect(() => { (async () => setPapers(await loadPapers()))(); }, []);

  const savedList = useMemo(() => papers.filter(p => ids.has(p.id)), [papers, ids]);

  const savedDois = useMemo(
    () => savedList.map(p => p.doi).filter((d): d is string => !!d && d.trim().length > 0),
    [savedList]
  );

  const titlesByDoi = useMemo(() => {
    const m: Record<string,string> = {};
    for (const p of savedList) {
      if (p.doi && p.title) m[p.doi.trim().toLowerCase()] = p.title;
    }
    return m;
  }, [savedList]);

  const savedIndexByDoi = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of savedList) {
      if (p.doi) m[p.doi.trim().toLowerCase()] = getIndex(p.id) ?? undefined as any;
    }
    return m;
  }, [savedList, getIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!savedDois.length) { setGraph(null); return; }
      try {
        setLoading(true);
        const g = await buildDirectCitationGraph({
          savedDois,
          titlesByDoi,
          edgesUrl: "/citation_edges.csv",
          savedIndexByDoi,
        });
        if (!cancelled) setGraph(g);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [savedDois, titlesByDoi, savedIndexByDoi]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />
      <section className="relative px-[40px] pt-10 pb-16">
        <div className="pointer-events-none absolute inset-0 bg-[#0c0814]" />
        <div className="relative z-10 mx-auto max-w-[1800px]">
          <header className="flex items-end justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="font-extrabold tracking-tight text-[clamp(24px,4.8vw,56px)]">Saved Papers</h1>
              <p className="mt-2 text-white/80 text-[clamp(14px,1.3vw,18px)]">
                Direct citations from your bookmarks. Shared references connect saved papers together.
              </p>
            </div>
            {savedList.length > 0 && (
              <button className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10" onClick={clearAll}>
                Clear all
              </button>
            )}
          </header>

          {/* Graph on top */}
          <div className="mt-8">
            {loading && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 text-center text-white/70">Building…</div>
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
                index={getIndex(p.id)}
              />
            ))}
            {savedList.length === 0 && (
              <div className="text-white/70 text-center col-span-full">
                You haven’t bookmarked anything yet. Go to <strong>All Papers</strong> and press “Bookmark”.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
