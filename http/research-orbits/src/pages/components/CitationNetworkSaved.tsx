// src/pages/components/CitationNetworkSaved.tsx
import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { DGGraph } from "../lib/directGraph";

type PosNode = DGGraph["nodes"][number] & { x?: number; y?: number; vx?: number; vy?: number };

const LAYOUT_CACHE_KEY = "savedNet:layout:v1";

export default function CitationNetworkSaved({
  graph,
  height = "55vh",
}: {
  graph: DGGraph;
  height?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Stable signature of graph content (prevents unnecessary re-layout)
  const signature = useMemo(() => {
    const ns = graph.nodes.map((n) => n.id).sort().join("|");
    const ls = graph.links
      .map((l) => `${l.source}->${l.target}:${l.kind}`)
      .sort()
      .join("|");
    return `${ns}__${ls}`;
  }, [graph]);

  // Cache helpers
  const loadLayoutCache = () => {
    try {
      const raw = localStorage.getItem(LAYOUT_CACHE_KEY);
      if (!raw) return null;
      const { sig, pos } = JSON.parse(raw);
      if (sig !== signature) return null;
      return pos as Record<string, { x: number; y: number }>;
    } catch {
      return null;
    }
  };
  const saveLayoutCache = (pos: Record<string, { x: number; y: number }>) => {
    try {
      localStorage.setItem(
        LAYOUT_CACHE_KEY,
        JSON.stringify({ sig: signature, pos })
      );
    } catch {}
  };

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    const W = wrapRef.current.clientWidth || 1200;
    const H = wrapRef.current.clientHeight || 600;

    // Prepare mutable copies for d3
    const nodes: PosNode[] = graph.nodes.map((n) => ({ ...n }));
    const links = graph.links.map((l) => ({ ...l }));

    // Try cached positions
    const cached = loadLayoutCache();
    if (cached) {
      for (const n of nodes) {
        const p = cached[n.id];
        if (p) {
          n.x = p.x;
          n.y = p.y;
        }
      }
    }

    // Build SVG skeleton once (no React state updates from here)
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .on("zoom", (ev) => g.attr("transform", String(ev.transform)))
    );

    // Gradients
    const defs = svg.append("defs");
    const lgSaved = defs
      .append("linearGradient")
      .attr("id", "nodeGradSaved")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    lgSaved.append("stop").attr("offset", "0%").attr("stop-color", "#7b2cbf"); // french_violet
    lgSaved.append("stop").attr("offset", "100%").attr("stop-color", "#9d4edd"); // amethyst

    const lgChild = defs
      .append("linearGradient")
      .attr("id", "nodeGradChild")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    lgChild.append("stop").attr("offset", "0%").attr("stop-color", "#22d3ee");
    lgChild.append("stop").attr("offset", "100%").attr("stop-color", "#8b5cf6");

    // Force simulation: run only if no cache or some nodes lack positions
    const needsLayout = nodes.some((n) => typeof n.x !== "number" || typeof n.y !== "number");

    if (needsLayout) {
      const sim = d3
        .forceSimulation(nodes as any)
        .force(
          "link",
          d3
            .forceLink(links as any)
            .id((d: any) => d.id)
            .distance((d: any) => (d.kind === "cocite" ? 160 : 90))
            .strength((d: any) => (d.kind === "cocite" ? 0.12 : 0.25))
        )
        .force("charge", d3.forceManyBody().strength(-220))
        .force("center", d3.forceCenter(W / 2, H / 2))
        .force("collision", d3.forceCollide().radius((d: any) => d.size + 6))
        .stop();

      const ITER = 260;
      for (let i = 0; i < ITER; i++) sim.tick();
      sim.stop();

      // Save final positions to cache
      const pos: Record<string, { x: number; y: number }> = {};
      for (const n of nodes) pos[n.id] = { x: n.x!, y: n.y! };
      saveLayoutCache(pos);
    }

    // Render once
    const linkSel = g
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d: any) => (d.kind === "cocite" ? "#94a3b8" : "#7dd3fc"))
      .attr("stroke-opacity", (d: any) => (d.kind === "cocite" ? 0.5 : 0.85))
      .attr("stroke-width", (d: any) => (d.kind === "cocite" ? 1 : 1.5))
      .attr("x1", (d: any) => (d.source as any).x)
      .attr("y1", (d: any) => (d.source as any).y)
      .attr("x2", (d: any) => (d.target as any).x)
      .attr("y2", (d: any) => (d.target as any).y);

    const nodeSel = g
      .selectAll("g.node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

    // Imperative tooltip (no React setState)
    let raf = 0;
    const showTip = (text: string, x: number, y: number) => {
      if (!tooltipRef.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = tooltipRef.current!;
        el.style.display = "block";
        el.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
        el.textContent = text;
      });
    };
    const hideTip = () => {
      if (!tooltipRef.current) return;
      tooltipRef.current.style.display = "none";
    };

    nodeSel
      .on("mousemove", (ev: MouseEvent, d: any) => {
        const label = d.label || d.id;
        showTip(label, ev.offsetX, ev.offsetY);
      })
      .on("mouseleave", hideTip);

    // Circles
    nodeSel
      .append("circle")
      .attr("r", (d: any) => d.size)
      .attr("fill", (d: any) => (d.isSaved ? "url(#nodeGradSaved)" : "url(#nodeGradChild)"))
      .attr("opacity", 0.96);

    // Big-index inside saved nodes
    nodeSel
      .filter((d: any) => d.isSaved && d.index)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#0b1020")
      .attr("font-weight", 800)
      .attr("font-size", (d: any) => Math.max(10, Math.min(18, d.size * 0.85)))
      .text((d: any) => String(d.index));

    // Drag without re-running forces
    nodeSel.call(
      d3
        .drag<SVGGElement, any>()
        .on("start", function () {
          d3.select(this).classed("dragging", true);
        })
        .on("drag", function (event, d: any) {
          d.x = event.x;
          d.y = event.y;
          d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
          linkSel
            .filter((l: any) => l.source === d || l.target === d)
            .attr("x1", (l: any) => (l.source as any).x)
            .attr("y1", (l: any) => (l.source as any).y)
            .attr("x2", (l: any) => (l.target as any).x)
            .attr("y2", (l: any) => (l.target as any).y);
        })
        .on("end", function () {
          d3.select(this).classed("dragging", false);
        })
    );

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [signature]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-2xl ring-1 ring-white/10 bg-white/[0.03] overflow-hidden"
      style={{ height }}
    >
      <svg ref={svgRef} width="100%" height="100%" />
      <div
        ref={tooltipRef}
        style={{ display: "none" }}
        className="pointer-events-none absolute rounded-lg bg-black/70 text-white text-xs px-2 py-1"
      />
    </div>
  );
}
