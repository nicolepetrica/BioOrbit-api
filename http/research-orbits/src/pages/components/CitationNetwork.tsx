// src/components/CitationNetwork.tsx
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Graph } from "../lib/citationGraph";

function useSize(ref: React.RefObject<HTMLDivElement>) {
  const [size, setSize] = React.useState({ w: 800, h: 560 });
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect;
        setSize({
          w: Math.max(600, cr.width),
          h: Math.max(420, Math.min(window.innerHeight * 0.7, cr.height || window.innerHeight * 0.7)),
        });
      }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return size;
}

export default function CitationNetwork({ graph }: { graph: Graph }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef  = useRef<SVGSVGElement>(null);
  const { w, h } = useSize(wrapRef);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // zoom/pan
    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .on("zoom", (ev) => g.attr("transform", String(ev.transform)))
    );

    // forces
    const sim = d3.forceSimulation(graph.nodes as any)
      .force("link", d3.forceLink(graph.links as any).id((d: any) => d.id).distance(80).strength(0.2))
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.size + 6));

    const link = g.selectAll("line")
      .data(graph.links)
      .enter()
      .append("line")
      .attr("stroke", "#7dd3fc")
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.2);

    const node = g.selectAll("g.node")
      .data(graph.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(d3.drag<SVGGElement, any>()
        .on("start", (ev, d: any) => {
          if (!ev.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (ev, d: any) => {
          d.fx = ev.x; d.fy = ev.y;
        })
        .on("end", (ev, d: any) => {
          if (!ev.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    node.append("circle")
      .attr("r", (d: any) => d.size)
      .attr("fill", "url(#nodeGrad)");

    // definitions for gradient
    const defs = svg.append("defs");
    const lg = defs.append("linearGradient")
      .attr("id", "nodeGrad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "100%");
    lg.append("stop").attr("offset", "0%").attr("stop-color", "#8b5cf6");
    lg.append("stop").attr("offset", "100%").attr("stop-color", "#22d3ee");

    // labels (truncate a bit for readability)
    const truncate = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    node.append("text")
      .text((d: any) => truncate(d.label ?? d.id))
      .attr("x", (d: any) => d.size + 6)
      .attr("y", 4)
      .attr("font-size", "12px")
      .attr("fill", "#e5e7eb");

    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [graph, w, h]);

  return (
    <div ref={wrapRef} className="w-full h-[70vh] rounded-2xl ring-1 ring-white/10 bg-white/[0.03] overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%"/>
    </div>
  );
}
