// src/components/ExplorersView.tsx
import React, { useMemo } from 'react';
import type { Paper } from '../lib/papers';
import D3HorizontalBarChart from './D3HorizontalBarChart'; // Import the new bar chart

// --- Configuration (UNCHANGED) ---
const TERMS_TO_EXCLUDE = new Set([
  'biology', 'medicine', 'computer science', 'chemistry', 
  'space (punctuation)', 'engineering', 'physics'
]);

// --- Data Processing (Simplified) ---
function calculateDynamicReadiness(papers: Paper[]) {
  if (!papers || papers.length === 0) return [];

  const conceptCounts = new Map<string, number>();
  papers.forEach(paper => {
    paper.concepts?.forEach(concept => {
      const lowerConcept = concept.toLowerCase();
      if (!TERMS_TO_EXCLUDE.has(lowerConcept)) {
        const formattedConcept = concept.charAt(0).toUpperCase() + concept.slice(1);
        conceptCounts.set(formattedConcept, (conceptCounts.get(formattedConcept) || 0) + 1);
      }
    });
  });

  const topDomains = Array.from(conceptCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7); // Use 7 domains for a good list size

  if (topDomains.length === 0) return [];

  const maxCount = topDomains[0][1];
  if (maxCount === 0) return [];

  const readinessData = topDomains.map(([domain, count]) => {
    const readiness = Math.round((count / maxCount) * 100);
    let summary = `${readiness}% mission readiness`;
    if (readiness < 60) summary += ' - needs investment';
    if (readiness > 75) summary += ' with active research';
    return { domain, readiness, summary };
  });

  // A bar chart looks best sorted, so we can do it here. The list will use the same sorted data.
  return readinessData.sort((a, b) => b.readiness - a.readiness);
}


// --- Main Explorer View Component ---
export default function ExplorersView({ papers }: { papers: Paper[] }) {
  const readinessData = useMemo(() => calculateDynamicReadiness(papers), [papers]);

  if (readinessData.length === 0) {
    return (
      <div className="text-center text-gray-400 p-10">
        Processing data or not enough concept data to generate insights.
      </div>
    );
  }
  
  return (
    <div className="space-y-12">
      {/* Mission Readiness Assessment Section */}
      <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10">
        <h2 className="text-xl font-bold text-white">Mission Readiness Assessment</h2>
        <p className="text-sm text-gray-400 mb-6">Research maturity across top mission domains</p>
        
        {/* Use the new Horizontal Bar Chart component */}
        <D3HorizontalBarChart data={readinessData} />
      </div>

      {/* Mission-Critical Research Areas Section */}
      <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Mission-Critical Research Areas</h2>
        <ul className="space-y-3 text-sm text-gray-300">
          {/* This list is already sorted correctly from the function above */}
          {readinessData.map(({ domain, summary }) => (
            <li key={domain} className="flex items-start">
              <span className="text-amber-400 mr-2 mt-1">•</span>
              <span>
                <span className="font-semibold text-amber-400">{domain}:</span> {summary}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}