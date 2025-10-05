import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface RadarChartProps {
  data: { domain: string; readiness: number }[];
}

export default function D3RadarChart({ data }: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Effect to observe container size for responsiveness
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Effect to draw the chart when data or dimensions change
  useEffect(() => {
    if (!dimensions || !data || data.length === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    // --- Chart Dimensions & Scales ---
    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    const centerX = width / 2;
    const centerY = height / 2;

    const numAxes = data.length;
    const angleSlice = (Math.PI * 2) / numAxes;
    const radiusScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

    const g = svg.append('g').attr('transform', `translate(${centerX}, ${centerY})`);

    // --- Draw Grid ---
    const levels = 4;
    for (let i = 0; i < levels; i++) {
      const levelFactor = radius * ((i + 1) / levels);
      
      const gridLine = d3.lineRadial<{ domain: string; readiness: number }>()
        .curve(d3.curveLinearClosed)
        .radius(levelFactor)
        // ROTATION FIX: Subtract PI/2 (90 degrees) to start the chart from the top.
        .angle((d, index) => index * angleSlice - Math.PI / 2);

      g.append('path')
        .attr('d', gridLine(data))
        .style('stroke', '#4A5568')
        .style('stroke-width', '1px')
        .style('fill', 'none');
    }

    // --- Draw Axes ---
    const axes = g.selectAll('.axis')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'axis');

    axes.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      // ROTATION FIX: Apply the same rotation to the axis lines.
      .attr('x2', (d, i) => radiusScale(100) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y2', (d, i) => radiusScale(100) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr('stroke', '#4A5568')
      .attr('stroke-width', '1px');

    // --- Draw Axis Labels ---
    axes.append('text')
      // ROTATION FIX: Apply the same rotation to the label positions.
      .attr('x', (d, i) => radiusScale(115) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr('y', (d, i) => radiusScale(115) * Math.sin(angleSlice * i - Math.PI / 2))
      .text(d => d.domain)
      .attr('fill', '#A0AEC0')
      .style('font-size', '14px') // Slightly larger font to match image
      .attr('dominant-baseline', 'middle')
      // TEXT ALIGNMENT FIX: Adjust text-anchor based on the label's position.
      .attr('text-anchor', (d, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const epsilon = 1e-6; // Small value for float comparison
        if (Math.abs(angle + Math.PI / 2) < epsilon || Math.abs(angle - Math.PI / 2) < epsilon) {
          return 'middle'; // Top or bottom
        } else if (angle > -Math.PI / 2 && angle < Math.PI / 2) {
          return 'start'; // Right side
        } else {
          return 'end'; // Left side
        }
      });

    // --- Draw Data Shape ---
    const radarLine = d3.lineRadial<{ domain: string; readiness: number }>()
      .curve(d3.curveLinearClosed)
      .radius(d => radiusScale(d.readiness))
      // ROTATION FIX: Apply the same rotation to the data shape.
      .angle((d, i) => i * angleSlice - Math.PI / 2);

    g.append('path')
      .datum(data)
      .attr('d', radarLine)
      .style('fill', '#8B5CF6')
      .style('fill-opacity', 0.6)
      .style('stroke', '#8B5CF6')
      .style('stroke-width', '2px');
      
  }, [data, dimensions]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '400px' }}>
      <svg ref={svgRef} width="100%" height="100%" />
    </div>
  );
}