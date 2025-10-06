// src/components/ResearchersView.tsx
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import type { Paper } from '../lib/papers';

const COLORS = [
  '#EA698B', '#D55D92', '#C05299', '#AC46A1', '#973AA8',
  '#822FAF', '#6D23B6', '#6411AD', '#571089', '#47126B'
];

const D3AreaChart = ({ data, keywords, focusedKeyword, onLegendClick }: {
    data: any[];
    keywords: string[];
    focusedKeyword: string | null;
    onLegendClick: (keyword: string | null) => void;
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver(entries => {
            if (!entries[0]) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!dimensions || !data || data.length === 0) return;
        const { width, height } = dimensions;
        const margin = { top: 20, right: 30, bottom: 100, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
        svg.selectAll('*').remove();
        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        
        const xScale = d3.scalePoint().domain(data.map(d => d.year)).range([0, innerWidth]);
        const maxY = d3.max(data, d => d3.max(keywords, k => d[k] || 0));
        const yScale = d3.scaleLinear().domain([0, (maxY ?? 0) * 1.1]).range([innerHeight, 0]).nice();

        const colorScale = d3.scaleOrdinal<string>().domain(keywords).range(COLORS);

        const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d'));
        g.append('g').attr('transform', `translate(0, ${innerHeight})`).call(xAxis).selectAll('text').style('fill', '#A0AEC0').attr('transform', 'rotate(-45)').style('text-anchor', 'end');
        
        const yAxis = d3.axisLeft(yScale);
        g.append('g').call(yAxis).selectAll('text').style('fill', '#A0AEC0');
        
        g.append('text').attr('transform', 'rotate(-90)').attr('y', 0 - margin.left).attr('x',0 - (innerHeight / 2)).attr('dy', '1em').style('text-anchor', 'middle').style('fill', '#A0AEC0').text('Frequency');
        g.append('g').attr('class', 'grid').call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => '')).selectAll('.grid path, .grid .tick line').style('stroke', '#4A5568').style('stroke-opacity', 0.7).style('stroke-dasharray', '3,3');
        
        const defs = svg.append('defs');
        keywords.forEach((keyword) => {
            const color = colorScale(keyword);
            const gradientId = `gradient-${keyword.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const gradient = defs.append('linearGradient').attr('id', gradientId).attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
            gradient.append('stop').attr('offset', '5%').attr('stop-color', color).attr('stop-opacity', 0.8);
            gradient.append('stop').attr('offset', '95%').attr('stop-color', color).attr('stop-opacity', 0);
        });
        
        const areaGenerator = d3.area<any>().x(d => xScale(d.year) ?? 0).y0(innerHeight).y1(d => yScale(d.value)).curve(d3.curveMonotoneX);
        const lineGenerator = d3.line<any>().x(d => xScale(d.year) ?? 0).y(d => yScale(d.value)).curve(d3.curveMonotoneX);

        keywords.forEach((keyword) => {
            const seriesData = data.map(d => ({ year: d.year, value: d[keyword] || 0 }));
            const isDimmed = focusedKeyword && focusedKeyword !== keyword;
            const gradientId = `gradient-${keyword.replace(/[^a-zA-Z0-9]/g, '-')}`;
            
            g.append('path').datum(seriesData).attr('fill', `url(#${gradientId})`).attr('d', areaGenerator).style('opacity', isDimmed ? 0.1 : 1).transition().duration(300);
            g.append('path').datum(seriesData).attr('fill', 'none').attr('stroke', colorScale(keyword)).attr('stroke-width', 2).attr('d', lineGenerator).style('opacity', isDimmed ? 0.15 : 1).transition().duration(300);
        });

        const legend = g.append('g').attr('transform', `translate(0, ${innerHeight + 60})`);
        const legendItemSize = 12;
        const legendSpacing = 120;
        const itemsPerRow = Math.max(1, Math.floor(innerWidth / legendSpacing));
        legend.selectAll('.legend-item').data(keywords).enter().append('g').attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(${(i % itemsPerRow) * legendSpacing}, ${Math.floor(i / itemsPerRow) * 25})`)
            .style('cursor', 'pointer')
            .style('opacity', d => (focusedKeyword && focusedKeyword !== d) ? 0.3 : 1)
            .on('click', (event, d) => onLegendClick(d as string))
            .call(g => {
                g.append('rect').attr('width', legendItemSize).attr('height', legendItemSize).attr('rx', 3).style('fill', d => colorScale(d as string));
                g.append('text').attr('x', legendItemSize + 5).attr('y', legendItemSize).text(d => d).style('fill', '#E2E8F0').style('font-size', '12px');
            });

    }, [data, keywords, dimensions, focusedKeyword, onLegendClick]);

    return <div ref={containerRef} className="w-full h-[500px] relative"><svg ref={svgRef}></svg></div>;
};

// --- YOUR PROVIDED DATA PROCESSING FUNCTION ---
const processAreaData = (papers: Paper[]) => {
    const keywordCountsByYear: { [year: number]: { [concept: string]: number } } = {};
    const totalKeywordCounts: { [concept: string]: number } = {};
  
    papers.forEach(paper => {
      const year = paper.year;
      const concepts = paper.concepts;
  
      if (year && concepts && !isNaN(year)) {
        if (!keywordCountsByYear[year]) keywordCountsByYear[year] = {};
        concepts.forEach(keyword => {
          keywordCountsByYear[year][keyword] = (keywordCountsByYear[year][keyword] || 0) + 1;
          totalKeywordCounts[keyword] = (totalKeywordCounts[keyword] || 0) + 1;
        });
      }
    });
  
    const sortedKeywords = Object.entries(totalKeywordCounts).sort(([, a], [, b]) => b - a);
    const isBiologyInTopTen = sortedKeywords.slice(0, 10).some(([k]) => k.toLowerCase() === 'biology');
    let topKeywords = (isBiologyInTopTen ? sortedKeywords.filter(([k]) => k.toLowerCase() !== 'biology') : sortedKeywords).slice(0, 10).map(([k]) => k);
  
    const allYears = [...new Set(Object.keys(keywordCountsByYear))]
      .map(y => parseInt(y, 10))
      .filter(y => !isNaN(y) && y >= 2010 && y <= new Date().getFullYear())
      .sort((a,b) => a - b);
  
    const chartData = allYears.map(year => {
      const yearData: { [key: string]: any, year: number } = { year };
      topKeywords.forEach(k => { yearData[k] = keywordCountsByYear[year]?.[k] || 0; });
      return yearData;
    });
    return { chartData, topKeywords };
};

// --- MAIN WRAPPER COMPONENT ---
export default function ResearchersView({ papers }: { papers: Paper[] }) {
  const [focusedKeyword, setFocusedKeyword] = useState<string | null>(null);

  const { chartData, topKeywords } = useMemo(() => processAreaData(papers), [papers]);

  const handleLegendClick = useCallback((clickedKeyword: string | null) => {
    setFocusedKeyword(prev => (prev === clickedKeyword ? null : clickedKeyword));
  }, []);

  if (chartData.length === 0) {
    return <div className="text-center text-gray-400 p-10">Loading trend data...</div>;
  }

  return (
    <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10">
      <h2 className="text-xl font-bold text-white">Top Concept Trends</h2>
      <p className="text-sm text-gray-400 mb-6">Publication frequency of key research topics over time. Click a legend item to focus.</p>
      
      <D3AreaChart 
        data={chartData} 
        keywords={topKeywords}
        focusedKeyword={focusedKeyword}
        onLegendClick={handleLegendClick}
      />
    </div>
  );
}