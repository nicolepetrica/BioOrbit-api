import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { csvParse, type DSVRowString } from 'd3-dsv';
import { ChevronDown } from 'lucide-react';

// --- Type Definitions ---
type PredictionDataPoint = {
  year: number;
  actual?: number;
  predicted?: number;
  ciLower?: number;
  ciUpper?: number;
};

type ProcessedData = {
  [concept: string]: {
    [metric: string]: PredictionDataPoint[];
  };
};

const PREDICTIONS_CSV_URL = '/arima_predictions_with_history.csv';

const METRIC_DESCRIPTIONS: { [key: string]: string } = {
  'Altmetric Score': 'A weighted score that tracks the attention a research output has received online, including news, blogs, and social media.',
  'Citations (Crossref)': 'The total number of times a paper has been cited by other academic papers, as tracked by the Crossref database.',
  'Social Media Mentions': 'A direct count of mentions on social media platforms like X (formerly Twitter), blogs, and other public forums.'
};

// --- Data Processing (Robust Cleaning) ---
function processPredictionData(rows: DSVRowString<string>[]): ProcessedData {
  const data: ProcessedData = {};

  rows.forEach(row => {
    // A more robust way to clean up concept names like `['medicine']` or `biology']`
    const concept = (row.Concept || 'Unknown').replace(/[\[\]"']/g, '').trim();
    const metric = row.Metric || 'Unknown';
    const year = parseInt(row.Year || '0', 10);

    if (!year || metric === 'Unknown' || concept === 'Unknown') return;

    if (year < 2010 || !year || metric === 'Unknown' || concept === 'unknown' || concept === '') {
      return;
    }

    if (!data[concept]) data[concept] = {};
    if (!data[concept][metric]) data[concept][metric] = [];

    data[concept][metric].push({
      year,
      actual: row.ActualValue ? parseFloat(row.ActualValue) : undefined,
      predicted: row.PredictedValue ? parseFloat(row.PredictedValue) : undefined,
      ciLower: row.CI_Lower ? parseFloat(row.CI_Lower) : undefined,
      ciUpper: row.CI_Upper ? parseFloat(row.CI_Upper) : undefined,
    });
  });

  // Sort each series by year
  Object.values(data).forEach(conceptMetrics => {
    Object.values(conceptMetrics).forEach(series => {
      series.sort((a, b) => a.year - b.year);
    });
  });

  return data;
}

// --- Helper Hook for Responsive Dimensions ---
function useChartDimensions(ref: React.RefObject<HTMLDivElement>) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
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

// --- Helper Component for D3 Axes ---
// This is the one place we let D3 touch the DOM, as it's the best tool for the job.
const Axis = ({ scale, transform, type }: { scale: any; transform: string; type: 'bottom' | 'left' }) => {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (ref.current) {
      const axisGenerator = type === 'bottom' ? d3.axisBottom(scale).tickFormat(d3.format('d')) : d3.axisLeft(scale);
      d3.select(ref.current).call(axisGenerator as any);
    }
  }, [scale, type]);

  return <g ref={ref} transform={transform} className="text-gray-400" />;
};


// --- The New, Declarative D3 Chart Component ---
const D3TrendChart = ({ data }: { data: PredictionDataPoint[] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useChartDimensions(containerRef);

  const margin = { top: 20, right: 30, bottom: 40, left: 60 };

  // Memoize all calculations to prevent re-computing on every render
  const { xScale, yScale, paths, historicalData, gridLines } = useMemo(() => {
    if (!dimensions || !data || data.length === 0) {
      return { xScale: null, yScale: null, paths: {}, historicalData: [], gridLines: [] };
    }

    const { width, height } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const localHistoricalData = data.filter(d => d.actual !== undefined);
    const forecastDataWithConnector = [...data.filter(d => d.predicted !== undefined)];

    if (localHistoricalData.length > 0) {
      const lastHistorical = localHistoricalData[localHistoricalData.length - 1];
      if (lastHistorical && lastHistorical.actual !== undefined) {
        forecastDataWithConnector.unshift({
          year: lastHistorical.year,
          predicted: lastHistorical.actual,
          ciLower: lastHistorical.actual, // Make sure connector has CI values
          ciUpper: lastHistorical.actual,
        });
      }
    }
    
    const localXScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year) as [number, number])
      .range([0, innerWidth]);

    const yMax = d3.max(data, d => Math.max(d.actual ?? 0, d.ciUpper ?? 0)) ?? 0;
    const localYScale = d3.scaleLinear()
      .domain([0, yMax > 0 ? yMax * 1.1 : 10])
      .range([innerHeight, 0]).nice();
      
    const areaGen = d3.area<PredictionDataPoint>()
      .defined(d => d.ciLower !== undefined && d.ciUpper !== undefined)
      .x(d => localXScale(d.year))
      .y0(d => localYScale(Math.max(0, d.ciLower ?? 0)))
      .y1(d => localYScale(d.ciUpper ?? 0));

    const lineGen = d3.line<PredictionDataPoint>()
      .x(d => localXScale(d.year))
      .y(d => localYScale(d.actual ?? 0));

    const predictionLineGen = d3.line<PredictionDataPoint>()
      .defined(d => d.predicted !== undefined)
      .x(d => localXScale(d.year))
      .y(d => localYScale(d.predicted ?? 0));
      
    return {
      xScale: localXScale,
      yScale: localYScale,
      paths: {
        area: areaGen(forecastDataWithConnector),
        historical: lineGen(localHistoricalData),
        prediction: predictionLineGen(forecastDataWithConnector),
      },
      historicalData: localHistoricalData,
      gridLines: localYScale.ticks().slice(1) // Get tick values for grid lines
    };
  }, [data, dimensions, margin]);


  if (!dimensions || !xScale || !yScale) {
    return <div ref={containerRef} className="w-full h-full min-h-[400px]" />;
  }
  
  const innerHeight = dimensions.height - margin.top - margin.bottom;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px]">
      <svg width="100%" height="100%" className="overflow-visible">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid Lines */}
          {gridLines.map(tick => (
            <line
              key={`grid-${tick}`}
              x1={0}
              x2={dimensions.width - margin.left - margin.right}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#4A5568"
              strokeOpacity={0.3}
            />
          ))}
          
          {/* Axes */}
          <Axis type="left" scale={yScale} transform="translate(0,0)" />
          <Axis type="bottom" scale={xScale} transform={`translate(0,${innerHeight})`} />

          {/* Data Paths */}
          <path d={paths.area || ""} fill="rgba(139, 92, 246, 0.2)" />
          <path d={paths.historical || ""} fill="none" stroke="#A0AEC0" strokeWidth={2} />
          <path d={paths.prediction || ""} fill="none" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5,5" />
        </g>
      </svg>
    </div>
  );
};

// --- Main Investors View Component ---
export default function InvestorsView() {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to a concept that will NOT be filtered out, like 'spaceflight'
  const [selectedConcept, setSelectedConcept] = useState<string>('spaceflight');
  const [selectedMetric, setSelectedMetric] = useState<string>('Altmetric Score');
  
  // Data fetching useEffect remains the same
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(PREDICTIONS_CSV_URL);
        if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.statusText}`);
        const text = await res.text();
        const rows = csvParse(text);
        const processed = processPredictionData(rows);
        setData(processed);
      } catch (e: any) {
        setError(e.message || 'Could not load prediction data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- THIS IS THE MAIN CHANGE ---
  // We will filter the concepts here before they are used in the UI.
  const { concepts, metrics } = useMemo(() => {
    if (!data) return { concepts: [], metrics: [] };

    const CONCEPTS_TO_EXCLUDE = ['biology', 'medicine'];

    // Filter the concepts list
    const conceptList = Object.keys(data)
      .filter(c => !CONCEPTS_TO_EXCLUDE.includes(c.toLowerCase()));

    const metricSet = new Set<string>();
    conceptList.forEach(concept => {
      Object.keys(data[concept]).forEach(metric => metricSet.add(metric));
    });
    return { concepts: conceptList, metrics: Array.from(metricSet) };
  }, [data]);
  
  // This effect ensures that if the initial `selectedConcept` is filtered out,
  // we automatically select the first available one from the new list.
  useEffect(() => {
    if(concepts.length > 0 && !concepts.includes(selectedConcept)) {
      setSelectedConcept(concepts[0]);
    }
  }, [concepts, selectedConcept]);
  
  useEffect(() => {
    if(metrics.length > 0 && !metrics.includes(selectedMetric)) {
      setSelectedMetric(metrics[0]);
    }
  }, [metrics, selectedMetric]);


  const currentData = data?.[selectedConcept]?.[selectedMetric] ?? [];

  const CustomSelect = ({ value, options, onChange, label }: { value: string; options: string[]; onChange: (val: string) => void, label: string; }) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-gray-800 border border-white/20 rounded-md py-2 pl-4 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 capitalize"
      >
        {options.map(opt => <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
    </div>
  );

  return (
    <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Investment & Trend Analysis</h2>
          <p className="text-sm text-gray-400">Historical data and ARIMA model forecasts for key concepts.</p>
        </div>
        <div className="flex items-center gap-4">
          <CustomSelect label="Concept" value={selectedConcept} options={concepts} onChange={setSelectedConcept} />
          <CustomSelect label="Metric" value={selectedMetric} options={metrics} onChange={setSelectedMetric} />
        </div>
      </div>

      {METRIC_DESCRIPTIONS[selectedMetric] && (
        <div className="mb-6 p-4 bg-gray-900/50 rounded-lg border border-white/10 text-center">
          <p className="text-sm text-gray-300 italic">{METRIC_DESCRIPTIONS[selectedMetric]}</p>
        </div>
      )}

      {loading && <div className="text-center text-gray-400 py-20">Loading data...</div>}
      {error && <div className="text-center text-red-400 py-20">{error}</div>}
      {!loading && !error && currentData.length > 0 && (
        <>
          <D3TrendChart data={currentData} />
          <div className="flex justify-center items-center flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-gray-400 rounded-full" />
              <span>Historical Data</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 border-b-2 border-dashed border-violet-500" />
              <span>Forecasted Trend</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-violet-500/20 rounded-sm" />
              <span>Confidence Interval</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}