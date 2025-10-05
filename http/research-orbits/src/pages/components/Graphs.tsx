import React, { useState, useEffect, useRef, useCallback } from 'react';
import { csvParse } from 'd3-dsv';
import * as d3 from 'd3';

// --- Helper Functions ---

const COLORS = [
  '#EA698B', '#D55D92', '#C05299', '#AC46A1', '#973AA8',
  '#822FAF', '#6D23B6', '#6411AD', '#571089', '#47126B'
];

const SUNBURST_CATEGORY_DESCRIPTIONS = {
    'Social Media Mentions': 'Total number of mentions across various social media platforms like Twitter, Facebook, etc.',
    'Mendeley Readers': 'The number of people who have saved this paper to their Mendeley library, indicating readership and interest.',
    'Altmetric Score': 'A weighted score that tracks the attention a research output has received online, including news, blogs, and social media.'
};

// --- Process data for Area Chart ---
const processAreaData = (csvText) => {
  const data = csvParse(csvText);
  const keywordCountsByYear = {};
  const totalKeywordCounts = {};

  data.forEach(row => {
    const yearString = row['Publication Year'];
    const conceptsString = row['OpenAlex Concepts'];
    if (yearString && conceptsString) {
      const year = parseInt(yearString, 10);
      if (isNaN(year)) return;
      if (!keywordCountsByYear[year]) keywordCountsByYear[year] = {};
      const keywords = conceptsString.split(',').map(k => k.trim()).filter(Boolean);
      keywords.forEach(keyword => {
        keywordCountsByYear[year][keyword] = (keywordCountsByYear[year][keyword] || 0) + 1;
        totalKeywordCounts[keyword] = (totalKeywordCounts[keyword] || 0) + 1;
      });
    }
  });
  
  const sortedKeywords = Object.entries(totalKeywordCounts).sort(([, a], [, b]) => b - a);
  const isBiologyInTopTen = sortedKeywords.slice(0, 10).some(([k]) => k.toLowerCase() === 'biology');
  let topKeywords = (isBiologyInTopTen ? sortedKeywords.filter(([k]) => k.toLowerCase() !== 'biology') : sortedKeywords).slice(0, 10).map(([k]) => k);

  const allYears = [...new Set(Object.keys(keywordCountsByYear))].map(y => parseInt(y, 10)).filter(y => y >= 2010 && y <= 2024).sort((a,b) => a - b);
  const chartData = allYears.map(year => {
    const yearData = { year };
    topKeywords.forEach(k => { yearData[k] = keywordCountsByYear[year]?.[k] || 0; });
    return yearData;
  });
  return { chartData, topKeywords };
};

const processBarData = (csvText, valueField) => {
    const data = csvParse(csvText);
    const paperData = data
        .map(row => ({
            title: row.Title,
            value: parseFloat(row[valueField]) || 0,
            link: row.Link,
            summary: row['TLDR Summary'],
            doi: row.DOI,
        }))
        .filter(d => d.value > 0 && d.title)
        .sort((a, b) => b.value - a.value);

    const topN = 40;
    const topPapers = paperData.slice(0, topN);

    const chartData = topPapers.map(p => ({ title: p.title, value: p.value, papers: [p] }));
    
    return chartData;
}

const processSunburstData = (csvText) => {
    const data = csvParse(csvText);
    const presenceData = data.map(row => ({
        mentions: parseFloat(row['Social Media Mentions']) || 0,
        readers: parseFloat(row['Mendeley Readers']) || 0,
        altmetric: parseFloat(row['Altmetric Score']) || 0,
        title: row.Title
    })).filter(d => (d.mentions > 0 || d.readers > 0 || d.altmetric > 0) && d.title);
    const presenceMap = { name: "Social Presence", children: [] };
    const categories = { 'Social Media Mentions': 'mentions', 'Mendeley Readers': 'readers', 'Altmetric Score': 'altmetric'};
    Object.keys(categories).forEach(catName => {
        const catNode = { name: catName, children: [] };
        presenceData.forEach(paper => {
            if (paper[categories[catName]] > 0) {
                catNode.children.push({ name: paper.title, value: paper[categories[catName]] });
            }
        });
        catNode.children = catNode.children.sort((a,b) => b.value - a.value).slice(0, 5);
        if (catNode.children.length > 0) presenceMap.children.push(catNode);
    });
    return presenceMap;
}

// --- Details Popover Component ---
const DetailsPopover = ({ data, onClose }) => {
    const popoverRef = useRef(null);
    const [popoverStyle, setPopoverStyle] = useState({});

    const updatePosition = useCallback(() => {
        if (!data || !data.barElement) return;
        const barRect = data.barElement.getBoundingClientRect();
        const style = {
            position: 'fixed',
            top: `${barRect.top}px`,
            left: `${barRect.right + 10}px`,
            transform: barRect.right + 350 > window.innerWidth ? `translateX(calc(-100% - ${barRect.width}px - 20px))` : 'none',
        };
        setPopoverStyle(style);
    }, [data]);

    useEffect(() => {
        updatePosition(); // Initial position
        
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose, updatePosition]);

    if (!data) return null;

    const isMultiple = data.barData.title === 'Other Papers';
    const paper = isMultiple ? null : data.barData.papers[0];

    const buttonStyle = "py-2 px-4 rounded-md text-xs font-semibold text-white transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900";

    return (
        <div ref={popoverRef} style={popoverStyle} className="bg-gray-900/80 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-2xl shadow-purple-500/20 p-4 w-80 max-h-[80vh] flex flex-col z-50 animate-fade-in-scale">
            <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl">&times;</button>
            <h3 className="text-md font-bold text-white mb-3 pr-4">{data.barData.title}</h3>
            {isMultiple ? (
                <div className="overflow-y-auto pr-2 text-sm custom-scrollbar">
                    <ul className="space-y-2">
                        {data.barData.papers.map((p, i) => (
                           <li key={i} className="flex justify-between items-center bg-gray-800/70 p-2 rounded">
                               <span className="truncate pr-2">{p.title}</span>
                               <span className="font-semibold text-indigo-400">{p.value.toFixed(2)}</span>
                           </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="flex-grow flex flex-col text-sm text-gray-300 overflow-hidden">
                    <a href={paper.link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline mb-2 break-words">View Source</a>
                    <p className="flex-grow overflow-y-auto pr-2 border-t border-b border-gray-700 py-2 my-2 custom-scrollbar">{paper.summary || "No summary available."}</p>
                    <div className="flex-shrink-0 flex items-center justify-end space-x-2 mt-2">
                        <button onClick={() => alert('Save Paper clicked!')} className={buttonStyle}>Save Paper</button>
                        <button onClick={() => alert('Ask AI clicked!')} className={buttonStyle}>Ask AI</button>
                        <button onClick={() => window.open(`https://doi.org/${paper.doi}`, '_blank')} className={buttonStyle}>Full Text</button>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- D3 Area Chart Component ---
const D3AreaChart = ({ data, keywords, focusedKeyword, onLegendClick }) => {
    const svgRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState(null);

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

    useEffect(() => {
        if (!dimensions || !data || data.length === 0) return;
        const { width, height } = dimensions;
        const margin = { top: 20, right: 30, bottom: 100, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
        svg.selectAll('*').remove();
        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        const xScale = d3.scaleLinear().domain(d3.extent(data, d => d.year)).range([0, innerWidth]);
        const maxY = d3.max(data, d => d3.max(keywords, k => d[k] || 0));
        const yScale = d3.scaleLinear().domain([0, maxY * 1.1]).range([innerHeight, 0]).nice();

        const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(Math.min(data.length, 15));
        g.append('g').attr('transform', `translate(0, ${innerHeight})`).call(xAxis).selectAll('text').style('fill', '#A0AEC0').attr('transform', 'rotate(-45)').style('text-anchor', 'end');
        const yAxis = d3.axisLeft(yScale);
        g.append('g').call(yAxis).selectAll('text').style('fill', '#A0AEC0');
        g.append('text').attr('transform', 'rotate(-90)').attr('y', 0 - margin.left).attr('x',0 - (innerHeight / 2)).attr('dy', '1em').style('text-anchor', 'middle').style('fill', '#A0AEC0').text('Frequency');
        g.append('g').attr('class', 'grid').call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat('')).selectAll('.grid path, .grid .tick line').style('stroke', '#4A5568').style('stroke-opacity', 0.7).style('stroke-dasharray', '3,3');
        const defs = svg.append('defs');
        keywords.forEach((_, i) => {
            const gradient = defs.append('linearGradient').attr('id', `gradient-${i}`).attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
            gradient.append('stop').attr('offset', '5%').attr('stop-color', COLORS[i % COLORS.length]).attr('stop-opacity', 0.8);
            gradient.append('stop').attr('offset', '95%').attr('stop-color', COLORS[i % COLORS.length]).attr('stop-opacity', 0);
        });
        
        const areaGenerator = d3.area().x(d => xScale(d.year)).y0(innerHeight).y1(d => yScale(d.value)).curve(d3.curveMonotoneX);
        const lineGenerator = d3.line().x(d => xScale(d.year)).y(d => yScale(d.value)).curve(d3.curveMonotoneX);

        keywords.forEach((keyword, i) => {
            const seriesData = data.map(d => ({ year: d.year, value: d[keyword] || 0 }));
            const isDimmed = focusedKeyword && focusedKeyword !== keyword;
            
            g.append('path').datum(seriesData).attr('fill', `url(#gradient-${i})`).attr('d', areaGenerator).style('opacity', isDimmed ? 0.1 : 1).transition().duration(300);
            g.append('path').datum(seriesData).attr('fill', 'none').attr('stroke', COLORS[i % COLORS.length]).attr('stroke-width', 2).attr('d', lineGenerator).style('opacity', isDimmed ? 0.15 : 1).transition().duration(300);
        });

        const legend = g.append('g').attr('transform', `translate(0, ${innerHeight + 60})`);
        const legendItemSize = 12;
        const legendSpacing = 120;
        const itemsPerRow = Math.max(1, Math.floor(innerWidth / legendSpacing));
        legend.selectAll('.legend-item').data(keywords).enter().append('g').attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(${(i % itemsPerRow) * legendSpacing}, ${Math.floor(i / itemsPerRow) * 25})`)
            .style('cursor', 'pointer')
            .style('opacity', d => (focusedKeyword && focusedKeyword !== d) ? 0.3 : 1)
            .on('click', (event, d) => onLegendClick(d))
            .call(g => {
                g.append('rect').attr('width', legendItemSize).attr('height', legendItemSize).attr('rx', 3).style('fill', (d, i) => COLORS[i % COLORS.length]);
                g.append('text').attr('x', legendItemSize + 5).attr('y', legendItemSize).text(d => d).style('fill', '#E2E8F0').style('font-size', '12px');
            });

    }, [data, keywords, dimensions, focusedKeyword, onLegendClick]);

    return <div ref={containerRef} className="w-full h-full relative"><svg ref={svgRef}></svg></div>;
};

// --- D3 Bar Chart Component ---
const D3BarChart = ({ data, yAxisLabel, onBarClick }) => {
    const svgRef = useRef();
    const containerRef = useRef();
    const tooltipRef = useRef();
    const [dimensions, setDimensions] = useState(null);

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

    useEffect(() => {
        if (!dimensions || !data || data.length === 0) return;
        const { width, height } = dimensions;
        const margin = { top: 20, right: 30, bottom: 30, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
        svg.selectAll('*').remove();
        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
        const xScale = d3.scaleBand().domain(data.map(d => d.title)).range([0, innerWidth]).padding(0.2);
        const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.value) * 1.1]).range([innerHeight, 0]);
        
        const yAxis = g.append('g').call(d3.axisLeft(yScale).tickFormat(d3.format(".2f")));
        yAxis.selectAll('text').style('fill', '#A0AEC0');

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (innerHeight / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('fill', '#A0AEC0')
            .text(yAxisLabel);

        const tooltip = d3.select(tooltipRef.current);
        const containerNode = containerRef.current;
        g.selectAll('.bar').data(data).enter().append('rect').attr('class', 'bar').attr('x', d => xScale(d.title)).attr('y', d => yScale(d.value)).attr('width', xScale.bandwidth()).attr('height', d => innerHeight - yScale(d.value)).attr('fill', (d, i) => COLORS[i % COLORS.length])
            .style('cursor', 'pointer')
            .on('mouseover', () => tooltip.transition().duration(200).style('opacity', .9))
            .on('mousemove', (event, d) => {
                const [x, y] = d3.pointer(event, containerNode);
                tooltip.html(`<strong>${d.title}</strong><br/>${yAxisLabel}: ${d.value.toFixed(2)}`).style('left', (x + 15) + 'px').style('top', (y - 28) + 'px');
            })
            .on('mouseout', () => tooltip.transition().duration(500).style('opacity', 0))
            .on('click', (event, d) => onBarClick(event, d));
            
    }, [data, dimensions, yAxisLabel, onBarClick]);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            <svg ref={svgRef}></svg>
            <div ref={tooltipRef} className="absolute pointer-events-none opacity-0 bg-gray-900 border border-gray-700 text-white p-2 rounded-md shadow-lg transition-opacity duration-200 text-sm max-w-xs"></div>
        </div>
    );
};

// --- D3 Sunburst Chart Component ---
const D3SunburstChart = ({ data }) => {
    const svgRef = useRef();
    const containerRef = useRef();
    const tooltipRef = useRef();
    const [dimensions, setDimensions] = useState(null);

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

    useEffect(() => {
        if (!dimensions || !data) return;

        const { width, height } = dimensions;
        const radius = Math.min(width, height) / 2 - 10;
        const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

        const hierarchy = d3.hierarchy(data).sum(d => d.value).sort((a, b) => b.value - a.value);
        const partition = d3.partition().size([2 * Math.PI, radius]);
        const root = partition(hierarchy);

        const svg = d3.select(svgRef.current).attr("width", width).attr("height", height).attr("viewBox", [-width / 2, -height / 2, width, height]);
        svg.selectAll('*').remove();
        const g = svg.append("g");
        const tooltip = d3.select(tooltipRef.current);
        const containerNode = containerRef.current;
        const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005)).padRadius(radius / 2).innerRadius(d => d.y0).outerRadius(d => d.y1 - 1);

        g.selectAll("path").data(root.descendants().filter(d => d.depth)).join("path")
            .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
            .attr("fill-opacity", 0.6).attr("d", arc)
            .on('mouseover', function() {
                d3.select(this).attr('fill-opacity', 0.8);
                tooltip.transition().duration(200).style('opacity', .9);
            })
            .on('mousemove', (event, d) => {
                const [x, y] = d3.pointer(event, containerNode);
                let tooltipContent = '';
                if (d.depth === 1) {
                    const categoryName = d.data.name;
                    const description = SUNBURST_CATEGORY_DESCRIPTIONS[categoryName] || '';
                    tooltipContent = `<strong>${categoryName}</strong><br/>${description}<br/><em>Total Value: ${d.value.toFixed(2)}</em>`;
                } else {
                    const path = d.ancestors().map(ancestor => ancestor.data.name).reverse().join(" / ");
                    tooltipContent = `<strong>${path}</strong><br/>Value: ${d.value.toFixed(2)}`;
                }
                tooltip.html(tooltipContent).style('left', (x + 15) + 'px').style('top', (y - 28) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('fill-opacity', 0.6);
                tooltip.transition().duration(500).style('opacity', 0);
            });

    }, [data, dimensions]);

    return (
        <div ref={containerRef} className="w-full h-full relative flex items-center justify-center">
            <svg ref={svgRef}></svg>
            <div ref={tooltipRef} className="absolute pointer-events-none opacity-0 bg-gray-900 border border-gray-700 text-white p-2 rounded-md shadow-lg transition-opacity duration-200 text-sm max-w-xs"></div>
        </div>
    );
};


// --- Chart Wrapper Components ---
const KeywordsGraph = ({ csvText }) => {
  const [chartData, setChartData] = useState(null);
  const [topKeywords, setTopKeywords] = useState([]);
  const [focusedKeyword, setFocusedKeyword] = useState(null);

  useEffect(() => {
    if (csvText) {
      const processed = processAreaData(csvText);
      setChartData(processed.chartData);
      setTopKeywords(processed.topKeywords);
    }
  }, [csvText]);

  const handleLegendClick = useCallback((clickedKeyword) => {
    setFocusedKeyword(prev => (prev === clickedKeyword ? null : clickedKeyword));
  }, []);

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 h-[70vh] flex flex-col">
      <div className="flex-shrink-0 mb-4 text-center">
        <h2 className="text-xl font-bold text-white">OpenAlex Concepts Over Time</h2>
        <p className="text-sm text-gray-400">Frequency of the top 10 concepts. Click a legend item to focus.</p>
      </div>
      <div className="flex-grow relative">
        {chartData ? <D3AreaChart data={chartData} keywords={topKeywords} focusedKeyword={focusedKeyword} onLegendClick={handleLegendClick} /> : <p>Processing data...</p>}
      </div>
    </div>
  );
};

const BarChartWrapper = ({ csvText, title, subtitle, valueField, yAxisLabel }) => {
    const [chartData, setChartData] = useState(null);
    const [popoverData, setPopoverData] = useState(null);

    useEffect(() => {
        if (csvText) setChartData(processBarData(csvText, valueField));
    }, [csvText, valueField]);

    const handleBarClick = useCallback((event, barData) => {
        const barElement = event.currentTarget;
        setPopoverData(prev => prev && prev.barData.title === barData.title ? null : { barData, barElement });
    }, []);
    
    const handleClosePopover = useCallback(() => setPopoverData(null), []);

    return (
        <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 h-[70vh] flex flex-col">
            <DetailsPopover data={popoverData} onClose={handleClosePopover} />
            <div className="flex-shrink-0 mb-4 text-center">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
            <div className="flex-grow relative flex items-center justify-center">
                {chartData ? <D3BarChart data={chartData} yAxisLabel={yAxisLabel} onBarClick={handleBarClick} /> : <p className="text-gray-300">Processing data...</p>}
            </div>
        </div>
    );
}

const SocialPresenceSunburst = ({ csvText }) => {
    const [chartData, setChartData] = useState(null);
    useEffect(() => { if (csvText) setChartData(processSunburstData(csvText)); }, [csvText]);
    return (
        <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 h-[70vh] flex flex-col">
            <div className="flex-shrink-0 mb-4 text-center">
                <h2 className="text-xl font-bold text-white">Social Media Presence</h2>
                <p className="text-sm text-gray-400">Breakdown of social engagement metrics.</p>
            </div>
            <div className="flex-grow relative flex items-center justify-center">
                {chartData ? <D3SunburstChart data={chartData} /> : <p className="text-gray-300">Processing data...</p>}
            </div>
        </div>
    );
}

// --- Main App Component ---
export default function App() {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('./papers_enriched.csv');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        setCsvText(text);
      } catch (e) {
        console.error("Failed to load or process data:", e);
        setError("Could not load the CSV file. Make sure 'papers_enriched.csv' is in the public directory.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
        <style>{`
            @keyframes fadeInScale {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
            .animate-fade-in-scale { animation: fadeInScale 0.3s ease-out forwards; }
        `}</style>
        <div className="bg-gray-900 min-h-screen text-white">
            {loading && <div className="text-center p-8">Loading...</div>}
            {error && <div className="text-center p-8 text-red-400">{error}</div>}
            {!loading && !error && (
                 <div className="p-4 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <KeywordsGraph csvText={csvText} />
                    <BarChartWrapper csvText={csvText} title="Social Media Engagement" subtitle="Top papers by social media mentions." valueField="Social Media Mentions" yAxisLabel="Mentions" />
                    <BarChartWrapper csvText={csvText} title="Most Cited Papers" subtitle="Top papers by OpenAlex citations." valueField="Citations (OpenAlex)" yAxisLabel="Citations" />
                    <SocialPresenceSunburst csvText={csvText} />
                </div>
            )}
        </div>
    </>
  );
}