// src/components/StakeholderInsights.tsx
import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Rocket } from 'lucide-react';
import ExplorersView from './ExplorersView'; // Import the new component
import { loadPapers, type Paper } from '../lib/papers'; // Import the Paper type
import InvestorsView from './InvestorsView';
import ResearchersView from './ResearchersView';

type Tab = {
  id: 'researchers' | 'investors' | 'explorers';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const tabs: Tab[] = [
  { id: 'researchers', label: 'Researchers', icon: Users },
  { id: 'investors', label: 'Investors', icon: TrendingUp },
  { id: 'explorers', label: 'Explorers', icon: Rocket },
];

// This component now needs the `papers` prop to pass down to ExplorersView
export default function StakeholderInsights() {
  const [activeTab, setActiveTab] = useState<Tab['id']>('explorers');
  const [papers, setPapers] = useState<Paper[]>([]);

  const renderContent = () => {
    switch (activeTab) {
      case 'researchers':
        return <ResearchersView papers={papers} />;
      case 'investors':
        return <InvestorsView />;
      case 'explorers':
        return <ExplorersView papers={papers} />;
      default:
        return null;
    }
  };

  
    useEffect(() => {
        const fetchPapers = async () => {
          try {
            const loadedPapers = await loadPapers();
            setPapers(loadedPapers);
          } catch (err) {
            console.error("Failed to load papers:", err);
          }
        };
        fetchPapers();
      }, []);

  return (
    <div className="w-full">
      {/* Header Section (Simplified to match new design) */}
      <div className="text-center mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
          Stakeholder Insights
        </h1>
      </div>

      {/* Tab Navigation Bar (Slightly adjusted style to match the new image) */}
      <div className="flex justify-center mb-10">
        <div className="flex items-center space-x-2 bg-gray-900/70 rounded-full p-1 border border-white/10">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center justify-center gap-2 px-4 py-2 rounded-full
                  text-sm font-medium transition-colors duration-300
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400
                  ${isActive ? 'bg-violet-500 text-white' : 'text-gray-300 hover:bg-white/10'}
                `}
              >
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Display Area */}
      <div>
        {renderContent()}
      </div>
    </div>
  );
}