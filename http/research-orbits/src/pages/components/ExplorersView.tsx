import React, { useMemo } from 'react';
import type { Paper } from '../lib/papers'; // Adjust the import path as needed
 // Adjust the import path as needed
import D3RadarChart from './D3RadarChart'; // We still use our D3 component

// --- Configuration ---
// A set of common, high-frequency terms to exclude from the chart to get more specific insights.
// You can add or remove terms here to fine-tune the results.
const TERMS_TO_EXCLUDE = new Set([
  'biology',
  'medicine',
  'computer science',
  'chemistry',
  'space (punctuation)', // This seems to be a parsing artifact from your CSV
  'engineering',
  'physics',
]);

// --- NEW Dynamic Data Processing ---
// This function now dynamically finds the top domains from the provided papers.
function calculateDynamicReadiness(papers: Paper[]) {
  if (!papers || papers.length === 0) {
    return [];
  }

  const conceptCounts = new Map<string, number>();

  // 1. Count the frequency of all concepts across all papers
  papers.forEach(paper => {
    if (paper.concepts) {
      paper.concepts.forEach(concept => {
        const normalizedConcept = concept.trim().toLowerCase();
        if (normalizedConcept) {
          conceptCounts.set(normalizedConcept, (conceptCounts.get(normalizedConcept) || 0) + 1);
        }
      });
    }
  });

  // 2. Filter out excluded terms, then sort by frequency to find the top domains
  const sortedDomains = Array.from(conceptCounts.entries())
    .filter(([concept]) => !TERMS_TO_EXCLUDE.has(concept))
    .sort((a, b) => b[1] - a[1]);

  // 3. Take the top 6 domains for our chart
  const NUM_DOMAINS = 6;
  const topDomains = sortedDomains.slice(0, NUM_DOMAINS);

  if (topDomains.length === 0) {
    return []; // Return empty if no domains are found after filtering
  }

  // 4. Normalize the scores to a 0-100 readiness scale based on the most frequent term
  const maxCount = topDomains[0][1];
  if (maxCount === 0) return [];

  const readinessData = topDomains.map(([domain, count]) => {
    const readiness = Math.round((count / maxCount) * 100);
    let summary = `${readiness}% mission readiness`;
    
    // Add some flavor text based on the score
    if (readiness < 60) summary += ' - needs investment';
    if (readiness > 75) summary += ' with active research';

    // Capitalize the domain for better display
    const formattedDomain = domain.charAt(0).toUpperCase() + domain.slice(1);

    return { domain: formattedDomain, readiness, summary };
  });

  return readinessData;
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
      {/* Mission Readiness Assessment Section (UNCHANGED) */}
      <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10">
        <h2 className="text-xl font-bold text-white">Mission Readiness Assessment</h2>
        <p className="text-sm text-gray-400 mb-4">Research maturity across top mission domains</p>
        <D3RadarChart data={readinessData} />
      </div>

      {/* --- CHANGES ARE IN THIS SECTION --- */}
      <div className="bg-gray-800/50 p-6 rounded-xl border border-white/10">
        {/* 1. Adjusted heading size from text-xl font-bold to text-lg font-semibold */}
        <h2 className="text-lg font-semibold text-white mb-4">Mission-Critical Research Areas</h2>
        
        {/* 2. Added text-sm to the <ul> to make all list items smaller */}
        <ul className="space-y-3 text-sm text-gray-300">
          {readinessData.map(({ domain, summary }) => (
            <li key={domain} className="flex items-start">
              {/* 3. Changed bullet color from violet to amber */}
              <span className="text-amber-400 mr-2 mt-1">•</span>
              <span>
                {/* 4. Changed domain title color from white to amber */}
                <span className="font-semibold text-amber-400">{domain}:</span> {summary}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}