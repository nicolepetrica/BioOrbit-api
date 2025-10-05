import React from 'react';
import * as d3 from 'd3';

// A simple hook to handle responsive chart dimensions
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

// A helper component to render D3 axes
const Axis = ({ scale, transform, type }: { scale: any; transform: string; type: 'bottom' | 'left' }) => {
  const ref = React.useRef<SVGGElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      const axisGenerator = type === 'bottom' ? d3.axisBottom(scale).ticks(5) : d3.axisLeft(scale);
      d3.select(ref.current)
        .transition()
        .duration(300)
        .call(axisGenerator as any)
        .selectAll('text')
        .attr('fill', '#A0AEC0');
    }
  }, [scale, type]);

  return <g ref={ref} transform={transform} />;
};


interface BarChartProps {
  data: { domain: string; readiness: number }[];
}

export default function D3HorizontalBarChart({ data }: BarChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dimensions = useChartDimensions(containerRef);

  const margin = { top: 0, right: 40, bottom: 20, left: 120 };

  const { xScale, yScale, readyData } = React.useMemo(() => {
    if (!dimensions || !data) {
      return { xScale: null, yScale: null, readyData: [] };
    }
    
    // Sort data for display (highest readiness at the top)
    const sortedData = [...data].sort((a, b) => b.readiness - a.readiness);

    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    const localYScale = d3.scaleBand()
      .domain(sortedData.map(d => d.domain))
      .range([0, innerHeight])
      .padding(0.2);

    const localXScale = d3.scaleLinear()
      .domain([0, 100]) // Readiness is a percentage
      .range([0, innerWidth]);

    return { xScale: localXScale, yScale: localYScale, readyData: sortedData };
  }, [data, dimensions, margin]);


  if (!dimensions || !xScale || !yScale) {
    return <div ref={containerRef} className="w-full h-[400px]" />;
  }

  const innerWidth = dimensions.width - margin.left - margin.right;
  const innerHeight = dimensions.height - margin.top - margin.bottom;

  return (
    <div ref={containerRef} className="w-full h-[400px]">
      <svg width="100%" height="100%" className="overflow-visible">
        <defs>
          <linearGradient id="barGradient" gradientTransform="rotate(90)">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          <Axis type="bottom" scale={xScale} transform={`translate(0, ${innerHeight})`} />
          <Axis type="left" scale={yScale} transform="translate(0, 0)" />
          
          {readyData.map(d => (
            <g key={d.domain} transform={`translate(0, ${yScale(d.domain)})`}>
              <rect
                x={0}
                y={0}
                height={yScale.bandwidth()}
                width={0} // Initial width for animation
                fill="url(#barGradient)"
                rx={4}
              >
                <animate attributeName="width" from="0" to={xScale(d.readiness)} dur="0.5s" fill="freeze" />
              </rect>
              <text
                x={xScale(d.readiness) + 8}
                y={yScale.bandwidth() / 2}
                dominantBaseline="middle"
                fill="#EDE9FE"
                fontSize="12"
                fontWeight="600"
                opacity={0}
              >
                {d.readiness}%
                <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="0.3s" fill="freeze" />
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}