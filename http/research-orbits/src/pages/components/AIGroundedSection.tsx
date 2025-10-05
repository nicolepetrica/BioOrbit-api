// src/components/AIGroundedSection.tsx
import React from 'react';
import { BadgeCheck, GitBranch } from 'lucide-react';
import { PixelBackdrop } from './FeaturesSection';

// FeatureCard component remains the same
const FeatureCard: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({ icon: Icon, title, description }) => (
  <div className="bg-gray-900/50 p-6 rounded-xl border border-white/10">
    <Icon className="size-8 text-violet-400" />
    <h4 className="mt-4 font-semibold text-white">{title}</h4>
    <p className="mt-2 text-sm text-gray-400">{description}</p>
  </div>
);

// The main component no longer includes the stats section
const AIGroundedSection: React.FC = () => {
  return (
    <section className="relative w-full bg-indigo-950/40 py-20 sm:py-28 overflow-hidden">
      <PixelBackdrop />
      <div className="mx-auto max-w-6xl px-8 relative z-10">
        
        {/* AI Explanation Section */}
        <div className="mb-20 text-center">
          <h2 className="text-sm font-bold uppercase tracking-widest text-violet-400">
            AI Grounded in Science
          </h2>
          <h3 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Why not just ask your go-to LLM?
          </h3>
          <p className="mt-6 mx-auto max-w-2xl text-lg text-gray-300">
            We built a Retrieval-Augmented Generation (RAG) engine that draws information exclusively from a NASA validated database, ensuring confidence in your answers.
          </p>
        </div>

        {/* Feature Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FeatureCard 
            icon={BadgeCheck}
            title="Fully Traceable Source"
            description="Where's the Proof? We show you exactly where every insight originated so you can quickly verify the source article and save them to your favorite articles."
          />
          <FeatureCard 
            icon={GitBranch}
            title="Relational Analysis"
            description="Our AI is designed to cross-reference data and insights from multiple papers, establishing relationships between them and your own research."
          />
        </div>

      </div>
    </section>
  );
};

export default AIGroundedSection;