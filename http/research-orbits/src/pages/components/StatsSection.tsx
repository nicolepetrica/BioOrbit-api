// src/components/StatsSection.tsx (or add this to App.tsx)

import React from 'react';
import { PixelBackdrop } from './FeaturesSection';

const StatItem: React.FC<{ value: string; children: React.ReactNode }> = ({ value, children }) => (
  <div>
    <p className="text-3xl lg:text-4xl font-bold text-violet-300">{value}</p>
    <div className="mt-2 text-sm text-gray-400">{children}</div>
  </div>
);

const StatsSection: React.FC = () => {
    return (
        <section className="relative w-full bg-[#0c0814] py-16 sm:py-20 overflow-hidden">
            <PixelBackdrop />
            <div className="mx-auto max-w-6xl px-8 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                    <StatItem value="+600 papers">
                        <p>about Space Biology from a Nasa validated datasource</p>
                    </StatItem>
                    <StatItem value="10 fields of study">
                        <p>Biology, Medicine, Engineering, Geography, Enviromental Science, Computer Science, Chemistry, Physics, Material Science, History.</p>
                    </StatItem>
                    <StatItem value="+900 keywords">
                        <p>explore their usage over time to see future directions</p>
                    </StatItem>
                </div>
            </div>
        </section>
    );
};

export default StatsSection;