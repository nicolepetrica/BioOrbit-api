// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { csvParse } from "d3-dsv";
import Navbar from "./components/Navbar";
import Graphs from "./components/Graphs";
import StakeholderInsights from "./components/StakeholderInsights";
import FeatureCard from "./components/FeatureCard";

/* --------------------------------- Data --------------------------------- */
export type Node = {
  id: string;
  title: string;
  papers: number;
  journals: number;
  citations: number;
  color: { from: string; to: string; darkText?: boolean };
  size: number;
  link?: string;
};

const CSV_URL = "/papers_enriched.csv";

/* utils */
function svgSafeId(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9_-]+/gi, "-");
}
function colorFor(key: string) {
  const gradients: Array<{ from: string; to: string; darkText?: boolean }> = [
    { from: "#FDE68A", to: "#F59E0B" },
    { from: "#93C5FD", to: "#3B82F6" },
    { from: "#86EFAC", to: "#14B8A6" },
    { from: "#A5B4FC", to: "#6366F1" },
    { from: "#F0ABFC", to: "#A855F7" },
    { from: "#FDA4AF", to: "#F43F5E" },
    { from: "#E5E7EB", to: "#D1D5DB", darkText: true },
    { from: "#FCD34D", to: "#F59E0B" },
  ];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return gradients[h % gradients.length];
}
function splitFields(raw: string): string[] {
  if (!raw) return [];
  const noBrackets = raw.replace(/^\s*\[|\]\s*$/g, "");
  return noBrackets
    .split(/[;,|]/)
    .map((s) =>
      s
        .replace(/^\s*['"“‘]+|\s*['"”’]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}
function buildNodesFromCsv(text: string): Node[] {
  const rows = csvParse(text);
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const fos = String((r as any)["FieldsOfStudy"] || "");
    splitFields(fos).forEach((f) => counts.set(f, (counts.get(f) || 0) + 1));
  });
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return [];
  const arr = entries.map(([, c]) => c);
  const cMin = Math.min(...arr);
  const cMax = Math.max(...arr);
  const dMin = 70, dMax = 200;
  const scale = (c: number) =>
    cMax === cMin ? dMax : dMin + ((c - cMin) * (dMax - dMin)) / (cMax - cMin);

  return entries
    .map(([field, count]) => ({
      id: field,
      title: field,
      papers: count,
      journals: 0,
      citations: 0,
      color: colorFor(field),
      size: Math.round(scale(count)),
      link: `#${encodeURIComponent(field)}`,
    }))
    .slice(0, 32);
}

/* ----------------------- Auto-fitting label helper ---------------------- */
function layoutLabel(text: string, r: number) {
  const maxWidth = 2 * r * 0.82;
  const k = 0.58;
  const base = Math.max(12, r / 6);
  const words = text.split(" ").filter(Boolean);
  let lines = [text];

  if (words.length > 1 && text.length > 10) {
    const mid = Math.round(words.length / 2);
    const a = words.slice(0, mid).join(" ");
    const b = words.slice(mid).join(" ");
    const altMid = Math.max(1, mid - 1);
    const a2 = words.slice(0, altMid).join(" ");
    const b2 = words.slice(altMid).join(" ");
    const l1 = Math.abs(a.length - b.length);
    const l2 = Math.abs(a2.length - b2.length);
    lines = l2 < l1 ? [a2, b2] : [a, b];
  }

  const longest = Math.max(...lines.map((s) => s.length)) || 1;
  let fs = Math.min(base, maxWidth / (k * longest));
  if (lines.length === 2) {
    const totalH = fs * 2 + 6;
    const maxH = 2 * r * 0.9;
    if (totalH > maxH) fs = Math.min(fs, (maxH - 6) / 2);
  }
  const minFont = 10;
  const fits = maxWidth >= k * fs && fs >= minFont;
  if (!fits) return { lines: ["..."], fontSize: Math.max(10, r / 5), show: true, placeholder: true };
  return { lines, fontSize: fs, show: true, placeholder: false };
}

/* ---------------------------- Bubble graph ------------------------------ */
function BubbleGraph({ width, height, nodes }: { width: number; height: number; nodes: Node[] }) {
  type P = { id: string; r: number; x: number; y: number; vx: number; vy: number };
  const [pts, setPts] = useState<P[]>([]);
  const [hover, setHover] = useState<null | { node: Node; x: number; y: number }>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const idealCell = Math.min(420, Math.max(300, width / 4));
    const cols = Math.max(3, Math.floor(width / idealCell));
    const rows = Math.ceil(nodes.length / cols);
    const cellW = width / cols;
    const cellH = height / Math.max(1, rows);
    const scaleR = Math.min(1.25, Math.max(0.7, width / 1000));

    setPts(
      nodes.map((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          id: n.id,
          r: (n.size / 2) * scaleR,
          x: col * cellW + cellW / 2 + (Math.random() - 0.5) * 20,
          y: row * cellH + cellH / 2 + (Math.random() - 0.5) * 20,
          vx: 0,
          vy: 0,
        };
      })
    );
  }, [nodes, width, height]);

  useEffect(() => {
    if (!pts.length) return;
    const center = { x: width / 2, y: height / 2 };
    let running = true;

    const step = () => {
      if (!running) return;
      const alpha = 0.08;

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const min = a.r + b.r + 8;
          if (d < min) {
            const diff = (min - d) / d;
            const ox = dx * 0.5 * diff, oy = dy * 0.5 * diff;
            a.x -= ox; a.y -= oy; b.x += ox; b.y += oy;
          }
        }
      }

      for (const p of pts) {
        p.vx += (center.x - p.x) * alpha * 0.02;
        p.vy += (center.y - p.y) * alpha * 0.02;
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.9; p.vy *= 0.9;
        p.x = Math.max(p.r + 8, Math.min(width - p.r - 8, p.x));
        p.y = Math.max(p.r + 8, Math.min(height - p.r - 8, p.y));
      }
      setPts([...pts]);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { running = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pts, width, height]);

  const map = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        {pts.map((p) => {
          const node = map[p.id] as Node;
          const gid = svgSafeId(p.id);
          return (
            <g
              key={p.id}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHover({ node, x: p.x, y: p.y })}
              onMouseLeave={() => setHover(null)}
              onClick={() => node.link && (window.location.hash = node.link)}
              className="cursor-pointer"
            >
              <defs>
                <linearGradient id={`lg-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={node.color.from} />
                  <stop offset="100%" stopColor={node.color.to} />
                </linearGradient>
                <radialGradient id={`gloss-${gid}`} cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="black" stopOpacity="0.18" />
                </radialGradient>
              </defs>

              <circle r={p.r} fill={`url(#lg-${gid})`} />
              <circle r={p.r} fill={`url(#gloss-${gid})`} opacity={0.35} />

              {(() => {
                const { lines, fontSize, show, placeholder } = layoutLabel(node.title, p.r);
                if (!show) return null;
                return (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`select-none pointer-events-none font-medium ${
                      node.color.darkText ? "text-slate-900" : "text-white"
                    } ${placeholder ? "opacity-70 italic" : ""}`}
                    style={{ fontSize }}
                  >
                    {lines.map((t, i) => (
                      <tspan key={i} x={0} dy={i === 0 ? 0 : Math.max(14, fontSize * 0.9)}>
                        {t}
                      </tspan>
                    ))}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </svg>

      {hover && (
        <div
          className="absolute -translate-x-1/2 mt-3 w-90 rounded-2xl border border-white/10 bg-white/20 p-4 text-white backdrop-blur-md shadow-xl"
          style={{
            left: Math.max(160, Math.min(width - 160, hover.x)),
            top: Math.max(16, Math.min(height - 180, hover.y + 40)),
          }}
        >
          <p className="text-sm/5 text-white/90">{hover.node.title || "Category"}</p>
          <h4 className="mt-1 text-base font-semibold">{hover.node.title || "Item"}</h4>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-white/10 p-2">
              <p className="text-white/70">Papers</p>
              <p className="font-semibold">{hover.node.papers}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-2">
              <p className="text-white/70">Journals</p>
              <p className="font-semibold">{hover.node.journals}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-2">
              <p className="text-white/70">Citations</p>
              <p className="font-semibold">{hover.node.citations}</p>
            </div>
          </div>
          <a href={hover.node.link || "#"} className="mt-3 inline-block text-sm font-medium underline decoration-white/50 hover:decoration-white">
            Check out subcategories
          </a>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Background pixels --------------------------- */
function PixelBackdrop() {
  const blocks = useMemo(() => {
    const arr: { x: number; y: number; s: number; o: number }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 6 + Math.random() * 10,
        o: 0.08 + Math.random() * 0.07,
      });
    }
    return arr;
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {blocks.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-sm bg-white/20"
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.s}rem`, height: `${b.s}rem`, opacity: b.o }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ Ask input ------------------------------- */
function AskBar() {
  return (
    <div className="mx-auto mt-8 w-full max-w-4xl rounded-3xl border border-amber-300/40 bg-amber-200/5 p-4 shadow-[0_0_0_6px_rgba(245,197,66,0.15)_inset] transition-opacity duration-300">
      <div className="flex items-center gap-3">
        <Search className="size-5 text-amber-200" />
        <input
          placeholder="Ask a question to over 600 Space Biology publications"
          className="w-full bg-transparent text-sm text-amber-100 placeholder:text-amber-200/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ------------------------------- Hero ----------------------------------- */
function Hero() {


  return (
    <section id="hero" className="relative w-screen overflow-hidden px-[40px] pt-12 pb-20 sm:pt-16 lg:pt-20">
      <PixelBackdrop />

      {/* Centered hero content, full page width with 40px pad, capped at 1800px */}
      <div className="mx-auto max-w-[1800px] text-center">
        <h1 className="font-extrabold tracking-tight text-[clamp(28px,5.6vw,72px)]">
          Your Hub for NASA&apos;s Space Biology Research
        </h1>
          <p className="mx-auto mt-8 max-w-[1200px] text-white/80 text-[clamp(14px,1.5vw,20px)]">
          Explore into over 600 research papers from NASA’s Space Biology program, a vast
          collection about how life adapts, evolves, and survives beyond Earth.
        </p>

     {/* Feature boxes */}
      <div
        className="
          mx-auto w-full max-w-[1400px]
          grid grid-cols-1 md:grid-cols-2
          gap-6 lg:gap-8
          place-items-stretch
          mt-14 lg:mt-16 xl:mt-20
        "
      >
        <FeatureCard icon="/icons/analytics.svg"
                    title="Explore trends and citation patterns and see how research developed through time" />
        <FeatureCard icon="/icons/graph_3.svg"
                    title="Ask questions and uncover research insights powered by AI" />
        <FeatureCard icon="/icons/network.svg"
                    title="Save your favorite papers and see how they relate to each other" />
        <FeatureCard icon="/icons/upload.svg"
                    title="Upload your own papers to see how they link with specific NASA’s research network" />
      </div>

      <button
        onClick={() => {
          const el = document.getElementById("footer");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "end" });
          else window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }}
        className="mx-auto mt-20 inline-flex items-center justify-center rounded-full
                  border border-white/15 bg-white/5 px-4 py-2 text-[clamp(12px,1vw,14px)]
                  text-white/80 hover:bg-white/10 hover:text-white transition"
      >
        Scroll to explore
      </button>


      </div>
    </section>
  );
}

/* --------------------------------- Page --------------------------------- */
  export default function Home() {
    const [w, setW] = useState(1100);
    const [h, setH] = useState(520);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [showAsk, setShowAsk] = useState(false);
    const bubbleSectionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      fetch(CSV_URL)
        .then((r) => r.text())
        .then((txt) => setNodes(buildNodesFromCsv(txt)))
        .catch((err) => console.error("CSV load error", err));
    }, []);

    // responsive sizing — 40px page padding => width ≈ vw - 20
    useEffect(() => {
      const onResize = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setW(Math.max(360, Math.floor(vw - 40)));
        setH(Math.max(480, Math.min(Math.floor(vh * 0.72), 900)));
      };
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);

    // show AskBar when bubbles are on screen
    useEffect(() => {
      if (!bubbleSectionRef.current) return;
      const obs = new IntersectionObserver(
        ([entry]) => setShowAsk(entry.isIntersecting && entry.intersectionRatio > 0.15),
        { threshold: [0, 0.15, 0.4] }
      );
      obs.observe(bubbleSectionRef.current);
      return () => obs.disconnect();
    }, []);

    return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />

      {/* HERO */}
      <Hero />
      <section id="trends" ref={bubbleSectionRef} className="relative px-[40px]">
        <PixelBackdrop />
        <div className="mx-auto max-w-[1800px]">

          <BubbleGraph width={w} height={h} nodes={nodes} />
          
          <div id="ask" className="scroll-mt-20">{showAsk && <AskBar />}</div>
          
          <footer id="footer" className="mt-16 pb-16 text-center text-white/60 text-[clamp(11px,0.9vw,13px)]">
            © {new Date().getFullYear()} Research Orbits — Space Biology Research
          </footer>
        </div>
      </section>
    </main>
  );
  }
