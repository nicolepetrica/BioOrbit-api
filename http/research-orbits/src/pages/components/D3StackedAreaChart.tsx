// src/components/D3StackedAreaChart.tsx
import React from 'react';
import * as d3 from 'd3';

// You can move these helpers to a shared file like `src/components/chartHooks.ts` if you want
function useChartDimensions(ref: React.RefObject<HTMLDivElement>) {
  const [dimensions, setDimensions] = React.useState<{ width: number; height: number } | null>(null);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [ref]);
  return dimensions;
}

const Axis = ({ scale, transform, type }: { scale: any; transform: string; type: 'bottom' | 'left' }) => {
  const ref = React.useRef<SVGGElement>(null);
  React.useEffect(() => {
    if (ref.current) {
      const axisGenerator = type === 'bottom' ? d3.axisBottom(scale).tickFormat(d3.format('d')) : d3.axisLeft(scale);
      d3.select(ref.current).transition().duration(300).call(axisGenerator as any).selectAll('text').attr('fill', '#A0AEC0');
    }
  }, [scale, type]);
  return <g ref={ref} transform={transform} />;
};

// --- Main Chart Component ---
interface AreaChartProps {
  data: { [key: string]: any; year: number }[];
  keys: string[];
  hoveredConcept: string | null;
  setHoveredConcept: (concept: string | null) => void;
}

export default function D3StackedAreaChart({ data, keys, hoveredConcept, setHoveredConcept }: AreaChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dimensions = useChartDimensions(containerRef);

  const margin = { top: 10, right: 30, bottom: 80, left: 50 };

  const { xScale, yScale, series, colorScale } = React.useMemo(() => {
    if (!dimensions || !data || data.length === 0) {
      return { xScale: null, yScale: null, series: [], colorScale: null };
    }

    const { width, height } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // The stack generator from D3 transforms our data into layers
    const stack = d3.stack().keys(keys);
    const stackedSeries = stack(data as any);

    const localXScale = d3.scalePoint()
      .domain(data.map(d => d.year))
      .range([0, innerWidth]);

    const yMax = d3.max(stackedSeries, s => d3.max(s, d => d[1])) ?? 0;
    const localYScale = d3.scaleLinear()
      .domain([0, yMax * 1.1])
      .range([innerHeight, 0]).nice();

    const localColorScale = d3.scaleOrdinal<string>()
      .domain(keys)
      .range(['#FF9E00', '#7B2CBF', '#FF6D00', '#5A189A', '#FF8500', '#3C096C', '#FF7900']); // Your custom palette

    return { xScale: localXScale, yScale: localYScale, series: stackedSeries, colorScale: localColorScale };
  }, [data, keys, dimensions, margin]);

  if (!dimensions || !xScale || !yScale || !colorScale) {
    return <div ref={containerRef} className="w-full h-[400px]" />;
  }

  const innerHeight = dimensions.height - margin.top - margin.bottom;
  const innerWidth = dimensions.width - margin.left - margin.right;

  const areaGenerator = d3.area<any>()
    .x(d => xScale(d.data.year) ?? 0)
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX);

  return (
    <div ref={containerRef} className="w-full h-[400px]">
      <svg width="100%" height="100%" className="overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          <Axis type="left" scale={yScale} transform="translate(0,0)" />
          <Axis type="bottom" scale={xScale} transform={`translate(0, ${innerHeight})`} />

          {series.map(s => (
            <path
              key={s.key}
              d={areaGenerator(s) || ''}
              fill={colorScale(s.key)}
              fillOpacity={hoveredConcept === null || hoveredConcept === s.key ? 0.7 : 0.2}
              onMouseEnter={() => setHoveredConcept(s.key)}
              onMouseLeave={() => setHoveredConcept(null)}
              className="transition-all duration-300 cursor-pointer"
            />
          ))}
        </g>
      </svg>
      {/* Legend */}
      <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 mt-4">
        {keys.map(key => (
          <div 
            key={key} 
            className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer"
            onMouseEnter={() => setHoveredConcept(key)}
            onMouseLeave={() => setHoveredConcept(null)}
          >
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colorScale(key) }} />
            <span style={{ opacity: hoveredConcept === null || hoveredConcept === key ? 1 : 0.5 }}>
              {key}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}