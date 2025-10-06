// src/pages/components/CitationNetworkSaved.tsx
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { DGGraph } from "../lib/directGraph";

export default function CitationNetworkSaved({
  graph,
  height = "55vh" as string | number,
}: {
  graph: DGGraph;
  height?: string | number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    // --- START: Added for copy-on-click functionality ---
    let isCopying = false;
    let copyTimeout: NodeJS.Timeout;
    // --- END: Added for copy-on-click functionality ---

    // Root selections
    const wrap = d3.select(wrapRef.current);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // reset

    // Make wrapper the positioning context for the tooltip
    wrap.style("position", "relative");

    // HTML tooltip (always-on-top)
    const tooltip = wrap
      .append("div")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("z-index", "50")
      .style("background", "rgba(16,16,32,0.9)")
      .style("color", "white")
      .style("border", "1px solid rgba(255,255,255,0.15)")
      .style("backdrop-filter", "blur(6px)")
      .style("padding", "8px 10px")
      .style("border-radius", "10px")
      .style("font-size", "12px")
      .style("line-height", "1.2")
      .style("opacity", "0");

    const showTip = (ev: any, d: any) => {
      if (isCopying) return; // Don't show if copy confirmation is active
      const [x, y] = d3.pointer(ev, wrapRef.current);
      const title =
        d.label && d.label !== d.id
          ? `<div style="opacity:.9;margin-bottom:4px">${d.label}</div>`
          : "";
      tooltip
        .html(`${title}<div style="opacity:.7">DOI: ${d.id || "N/A"}</div>`)
        .style("left", `${x + 14}px`)
        .style("top", `${y + 14}px`)
        .style("opacity", "1");
    };

    const moveTip = (ev: any) => {
      if (isCopying) return; // Don't move if copy confirmation is active
      const [x, y] = d3.pointer(ev, wrapRef.current);
      tooltip.style("left", `${x + 14}px`).style("top", `${y + 14}px`);
    };

    const hideTip = () => {
      if (isCopying) return; // Don't hide if copy confirmation is active
      tooltip.style("opacity", "0");
    };

    // --- START: Added for copy-on-click functionality ---
    const handleNodeClick = (ev: any, d: any) => {
      if (!d.id) return;
      navigator.clipboard.writeText(d.id).then(() => {
        isCopying = true;
        clearTimeout(copyTimeout); // Clear any previous hide timeout

        const [x, y] = d3.pointer(ev, wrapRef.current);
        tooltip
          .html(`<div style="color:#4ade80; font-weight: 500;">Copied DOI!</div>`)
          .style("left", `${x + 14}px`)
          .style("top", `${y + 14}px`)
          .style("opacity", "1");
        
        // Set a timeout to hide the confirmation and unlock the tooltip
        copyTimeout = setTimeout(() => {
          tooltip.style("opacity", "0");
          isCopying = false;
        }, 1500);

      }).catch(err => console.error("Could not copy DOI: ", err));
    }
    // --- END: Added for copy-on-click functionality ---

    // Gradients
    const defs = svg.append("defs");
    const grad = defs
      .append("linearGradient")
      .attr("id", "savedGrad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#9d4edd");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#5a189a");

    // Zoom/pan group
    const g = svg.append("g");
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.25, 4])
        .on("zoom", (ev) => g.attr("transform", String(ev.transform)))
    );

    // Force simulation
    const sim = d3
      .forceSimulation(graph.nodes as any)
      .force(
        "link",
        d3
          .forceLink(graph.links as any)
          .id((d: any) => d.id)
          .distance(80)
          .strength(0.2)
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force(
        "center",
        d3.forceCenter(
          (svgRef.current?.clientWidth || 800) / 2,
          (svgRef.current?.clientHeight || 520) / 2
        )
      )
      .force(
        "collision",
        d3.forceCollide().radius((d: any) => (d.size || 10) + 6)
      );

    // Links
    const link = g
      .selectAll("line")
      .data(graph.links)
      .enter()
      .append("line")
      .attr("stroke", (d: any) =>
        d.kind === "direct" ? "#ff7900" : "#7dd3fc"
      )
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.4);

    // Nodes
    const node = g
      .selectAll("g.node")
      .data(graph.nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .style("cursor", "pointer") // Add pointer cursor to indicate clickability
      .on("mouseenter", showTip)
      .on("mousemove", moveTip)
      .on("mouseleave", hideTip)
      .on("click", handleNodeClick) // Add the click handler
      .call(
        d3
          .drag<SVGGElement, any>()
          .on("start", (ev, d: any) => {
            if (!ev.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (ev, d: any) => {
            d.fx = ev.x;
            d.fy = ev.y;
          })
          .on("end", (ev, d: any) => {
            if (!ev.active) sim.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d: any) => d.size || 10)
      .attr("fill", "url(#savedGrad)");

    // Bookmark index in the center (saved only)
    node
      .append("text")
      .text((d: any) => (d.isSaved && d.index ? String(d.index) : ""))
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-weight", "700")
      .attr("font-size", (d: any) => Math.max(10, Math.min(d.size, 20)))
      .attr("fill", "#0b1020");

    // Ticks
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
      clearTimeout(copyTimeout); // Clean up the timeout on component unmount
      tooltip.remove();
    };
  }, [graph, height]);

  return (
    <div
      ref={wrapRef}
      className="w-full rounded-2xl ring-1 ring-white/10 bg-white/[0.03] overflow-hidden"
    >
      <svg
        ref={svgRef}
        width="100%"
        height={typeof height === "string" ? height : `${height}px`}
      />
    </div>
  );
}