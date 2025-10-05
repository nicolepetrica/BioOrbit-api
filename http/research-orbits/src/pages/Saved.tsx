// src/Saved.tsx
import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import { csvParse } from "d3-dsv";

type SavedPaper = { title: string; path: string };

// Vite-friendly URL to the CSV in src/assets
const CSV_URL = new URL("/home/rideckszz/Documents/GitHub/NasaSpaceYags/http/research-orbits/src/assets/papers_index.csv", import.meta.url).href;

/** Tiny fake network (placeholder) – uses the loaded papers */
function NetworkPlaceholder({ papers }: { papers: SavedPaper[] }) {
  const nodes = useMemo(() => {
    const center = { x: 450, y: 150, r: 36, title: "Your Saved Papers" };
    const n = Math.min(10, papers.length);
    const ringR = 180;
    const ring = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return {
        x: center.x + Math.cos(a) * ringR,
        y: center.y + Math.sin(a) * ringR,
        r: 18,
        label: papers[i].title,
      };
    });
    return { center, ring };
  }, [papers]);

  return (
    <div className="relative mx-auto w-full max-w-[1100px]">
      <svg viewBox="0 0 900 320" className="w-full h-[320px] rounded-2xl ring-1 ring-white/10 bg-white/[0.03]">
        {nodes.ring.map((p, i) => (
          <line key={`l-${i}`} x1={nodes.center.x} y1={nodes.center.y} x2={p.x} y2={p.y} stroke="url(#glow)" strokeWidth="2" opacity="0.9" />
        ))}

        <defs>
          <radialGradient id="gloss" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id="nodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {nodes.ring.map((p, i) => (
          <g key={`n-${i}`} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={p.r} fill="url(#nodeGrad)" />
            <circle r={p.r} fill="url(#gloss)" opacity="0.35" />
          </g>
        ))}

        <g transform={`translate(${nodes.center.x}, ${nodes.center.y})`}>
          <circle r={nodes.center.r} fill="url(#nodeGrad)" />
          <circle r={nodes.center.r} fill="url(#gloss)" opacity="0.35" />
          <text textAnchor="middle" dominantBaseline="middle" className="fill-white" style={{ fontSize: 12, fontWeight: 600 }}>
            {nodes.center.title}
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function Saved() {
  const [papers, setPapers] = useState<SavedPaper[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(CSV_URL, { cache: "no-store" });
        const text = await res.text();
        const rows = csvParse(text) as unknown as Array<Record<keyof SavedPaper, string>>;
        const parsed = rows
          .map((r) => ({ title: (r.title || "").trim(), path: (r.path || "").trim() }))
          .filter((r) => r.title && r.path);
        if (!cancelled) setPapers(parsed);
      } catch (e) {
        console.error("Failed to load papers_index.csv", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />

      <section className="px-[40px] pt-10 pb-16">
        <div className="mx-auto max-w-[1800px]">
          <header className="text-center">
            <h1 className="font-extrabold tracking-tight text-[clamp(24px,4.8vw,56px)]">Saved Papers</h1>
            <p className="mx-auto mt-4 max-w-[900px] text-white/80 text-[clamp(14px,1.3vw,18px)]">
              A quick preview of papers you’ve bookmarked. Open any PDF directly; the network below is a temporary placeholder.
            </p>
          </header>

          {/* network placeholder */}
          <div className="mt-10">
            <NetworkPlaceholder papers={papers} />
          </div>

          {/* cards */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {papers.map((p, idx) => (
              <article
                key={`${p.path}-${idx}`}
                className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5 shadow-[inset_0_0_60px_rgba(255,255,255,0.045)]"
              >
                <h3 className="text-[clamp(15px,1.25vw,20px)] font-semibold line-clamp-2">{p.title}</h3>
                <p className="mt-2 text-white/70 text-[clamp(12px,1.05vw,15px)] line-clamp-3">
                  PDF preview is not rendered here; click <em>Open PDF</em> to view the full document.
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <a
                    href={p.path}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                  >
                    Open PDF
                  </a>
                </div>
              </article>
            ))}
            {papers.length === 0 && (
              <div className="text-white/70 text-center col-span-full">
                No papers found yet. Make sure <code>src/assets/papers_index.csv</code> exists and is readable.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
