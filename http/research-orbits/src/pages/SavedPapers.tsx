// src/pages/SavedPapers.tsx
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar.tsx";
import PaperCard from "./components/PaperCard";
import { loadPapers, type Paper } from "/home/rideckszz/Documents/GitHub/NasaSpaceYags/http/research-orbits/src/lib/papers.ts";
import { useBookmarks } from "/home/rideckszz/Documents/GitHub/NasaSpaceYags/http/research-orbits/src/hooks/useBookmarks.ts";

/* ---------- tiny placeholder charts (no deps) ---------- */
function NetworkPlaceholder() {
  const cx = 420, cy = 180, r = 38, n = 10, ringR = 130;
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * ringR, y: cy + Math.sin(a) * ringR };
  });
  return (
    <svg viewBox="0 0 640 360" className="w-full h-[260px]">
      <defs>
        <linearGradient id="np-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      {nodes.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="url(#np-g)" strokeWidth="2" opacity="0.7" />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="url(#np-g)" opacity="0.75" />
      {nodes.map((p, i) => (
        <circle key={`n-${i}`} cx={p.x} cy={p.y} r="10" fill="url(#np-g)" />
      ))}
    </svg>
  );
}

function BarsPlaceholder() {
  const bars = [60, 120, 90, 150, 110, 80, 130];
  return (
    <svg viewBox="0 0 640 220" className="w-full h-[180px]">
      <defs>
        <linearGradient id="bp-g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={30 + i * 80}
          y={180 - h}
          width="40"
          height={h}
          rx="6"
          fill="url(#bp-g)"
          opacity="0.85"
        />
      ))}
    </svg>
  );
}

function DonutPlaceholder() {
  // simple ring segments
  const cx = 110, cy = 110, r = 70, w = 18;
  const segs = [
    { a: 0.35, color: "#22d3ee" },
    { a: 0.25, color: "#8b5cf6" },
    { a: 0.20, color: "#a78bfa" },
    { a: 0.20, color: "#67e8f9" },
  ];
  let start = -Math.PI / 2;
  const arcs = segs.map((s) => {
    const end = start + s.a * Math.PI * 2;
    const large = s.a > 0.5 ? 1 : 0;
    const x1 = cx + Math.cos(start) * r, y1 = cy + Math.sin(start) * r;
    const x2 = cx + Math.cos(end) * r,   y2 = cy + Math.sin(end) * r;
    const x3 = cx + Math.cos(end) * (r - w), y3 = cy + Math.sin(end) * (r - w);
    const x4 = cx + Math.cos(start) * (r - w), y4 = cy + Math.sin(start) * (r - w);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}
               L ${x3} ${y3} A ${r - w} ${r - w} 0 ${large} 0 ${x4} ${y4} Z`;
    start = end;
    return { d, color: s.color };
  });
  return (
    <svg viewBox="0 0 220 220" className="w-full h-[220px]">
      {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} opacity="0.9" />)}
    </svg>
  );
}
/* ------------------------------------------------------ */

export default function SavedPapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const { ids, isBookmarked, toggle, clearAll } = useBookmarks();

  useEffect(() => {
    (async () => setPapers(await loadPapers()))();
  }, []);

  const savedOnly = useMemo(() => papers.filter((p) => ids.has(p.id)), [papers, ids]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />
      <section className="relative px-[40px] pt-10 pb-16">
        {/* Solid background to mask anything behind */}
        <div className="pointer-events-none absolute inset-0 bg-[#0c0814]" />

        <div className="relative z-10 mx-auto max-w-[1800px]">
          <header className="flex items-end justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="font-extrabold tracking-tight text-[clamp(24px,4.8vw,56px)]">
                Saved Papers
              </h1>
              <p className="mt-2 text-white/80 text-[clamp(14px,1.3vw,18px)]">
                Showing only items you bookmarked this session.
              </p>
            </div>
            {savedOnly.length > 0 && (
              <button
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                onClick={clearAll}
                title="Clear all bookmarks"
              >
                Clear all
              </button>
            )}
          </header>

          {savedOnly.length > 0 ? (
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedOnly.map((p) => (
                <PaperCard
                  key={p.id}
                  p={p}
                  isSaved={isBookmarked(p.id)}
                  onToggleSave={toggle}
                />
              ))}
            </div>
          ) : (
            /* -------- Empty state with placeholders to fill the right side -------- */
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Message card */}
              <div className="lg:col-span-4">
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-8 shadow-[inset_0_0_60px_rgba(255,255,255,0.045)]">
                  <h2 className="text-lg font-semibold">No saved papers yet</h2>
                  <p className="mt-2 text-white/70">
                    You haven’t bookmarked anything yet. Go to{" "}
                    <a
                      href="/all"
                      className="underline decoration-white/40 hover:decoration-white"
                    >
                      All Papers
                    </a>{" "}
                    and press <strong>Bookmark</strong>.
                  </p>
                </div>
              </div>

              {/* Placeholder visual stack */}
              <div className="lg:col-span-8 grid grid-cols-1 gap-6">
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <NetworkPlaceholder />
                </div>
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <BarsPlaceholder />
                </div>
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
                  <DonutPlaceholder />
                </div>
              </div>
            </div>
            /* --------------------------------------------------------------------- */
          )}
        </div>
      </section>
    </main>
  );
}
