// src/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { csvParse } from "d3-dsv";
import Navbar from "./components/Navbar";
import FeatureCard from "./components/FeatureCard";
import FeaturesSection from "./components/FeaturesSection";
import AIGroundedSection from "./components/AIGroundedSection";
import StatsSection from "./components/StatsSection";
import HeroBackground from "./components/HeroBackground";
import NasaChallengeFooter from "./components/NasaChallengeFooter";

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
  const gradients: Array<{ from: string }> = [
    { from: "#231942"},
    { from: "#5E548E"},
    { from: "#D9D9D9"},
    { from: "#3A325E"},
    { from: "#BE95C4"},
    { from: "#3C096C"},
    { from: "#5A189A"},
    { from: "#F2C141"},
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
  // This function remains unchanged
  const rows = csvParse(text);
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const fos = String((r as any)["FieldsOfStudy"] || "");
    fos.replace(/[\[\]'"]/g, '').split(/[,|;]/).map(f => f.trim()).filter(Boolean).forEach(f => counts.set(f, (counts.get(f) || 0) + 1));
  });
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return [];
  const arr = entries.map(([, c]) => c);
  const cMin = Math.min(...arr), cMax = Math.max(...arr);
  const dMin = 70, dMax = 200;
  const scale = (c: number) => cMax === cMin ? dMax : dMin + ((c - cMin) * (dMax - dMin)) / (cMax - cMin);

  return entries.map(([field, count]) => ({
    id: field, title: field, papers: count, journals: 0, citations: 0,
    color: colorFor(field), size: Math.round(scale(count)),
  })).slice(0, 32);
}

/* ---------------------------- Bubble graph ------------------------------ */
function BubbleGraph({ width, height, nodes }: { width: number; height: number; nodes: Node[] }) {
  type P = { id: string; r: number; x: number; y: number; vx: number; vy: number };
  const [pts, setPts] = useState<P[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const scaleR = Math.min(1.25, Math.max(0.7, width / 1000));
    setPts(
      nodes.map((n) => ({
        id: n.id, r: (n.size / 2) * scaleR,
        x: width / 2 + (Math.random() - 0.5) * width * 0.5,
        y: height / 2 + (Math.random() - 0.5) * height * 0.5,
        vx: 0, vy: 0,
      }))
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
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
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
      }
      setPts([...pts]);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { running = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pts, width, height]);

  const map = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <svg width={width} height={height} className="overflow-visible">
      {pts.map((p) => {
        const node = map[p.id] as Node;
        const gid = svgSafeId(p.id);
        return (
          <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
            <defs>
              <linearGradient id={`lg-${gid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={node.color.from} />
                <stop offset="100%" stopColor={node.color.to} />
              </linearGradient>
            </defs>
            <circle r={p.r} fill={`url(#lg-${gid})`} />
            
            {/* --- TEXT RENDERING LOGIC REMOVED --- */}
            {/* The block that rendered the text inside the bubbles has been deleted. */}

          </g>
        );
      })}
    </svg>
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

      <section className="relative flex items-center justify-center h-screen overflow-hidden z-0">
        <HeroBackground />
        
        {/* 2. The Hero Text Content */}
        <div className="relative z-10 mx-auto max-w-4xl text-center px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your Hub for <br />
            <span className="text-yellow-300">Space Biology Research</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
            Explore, save, ask questions and get recommendations from over 600 research papers about Space Biology.
          </p>
        </div>
      </section>

      <StatsSection />
      <AIGroundedSection />

      <FeaturesSection />


      <footer id="footer" className="py-16 text-center text-white/60 text-[clamp(11px,0.9vw,13px)]">
        © {new Date().getFullYear()} Research Orbits — Space Biology Research
      </footer>

      <NasaChallengeFooter />
    </main>
  );
  }
