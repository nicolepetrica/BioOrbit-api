// src/pages/AllPapers.tsx
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar.tsx";
import PaperCard from "./components/PaperCard";
import { loadPapers, type Paper } from "./lib/papers.ts";
import { useBookmarks } from "./hooks/useBookmarks.ts";

export default function AllPapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const { isBookmarked, toggle, getIndex } = useBookmarks();

  useEffect(() => {
    (async () => setPapers(await loadPapers()))();
  }, []);

  // (Optional) keep this if you use it elsewhere; otherwise can delete.
  const totalWithDoi = useMemo(
    () => papers.filter((p) => p.doi && p.doi.trim()).length,
    [papers]
  );

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
                Research everything and <strong>Bookmark</strong> to save items for this session.
        
              </p>
            </div>
          </header>

          {/* Cards */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {papers.map((p) => (
            <PaperCard
              key={p.id}
              p={p}
              isSaved={isBookmarked(p.id)}
              onToggleSave={() => toggle(p.id)}
              index={getIndex(p.id)}
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
