// src/components/FeaturesSection.tsx
import React, { useMemo } from 'react';
import FeaturePreview from './FeaturePreview';

// Reusable component for each feature row
interface FeatureRowProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function PixelBackdrop() {
  const blocks = useMemo(() => {
    const arr: { x: number; y: number; s: number; o: number }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 6 + Math.random() * 10,
        o: 0.08 + Math.random() * 0.07,
      });
    }
    return arr;
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {blocks.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-sm bg-white/20"
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.s}rem`, height: `${b.s}rem`, opacity: b.o }}
        />
      ))}
    </div>
  );
}


const FeatureRow: React.FC<FeatureRowProps> = ({ title, description, children }) => (
  <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
    <div>
      <h2 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">{title}</h2>
    </div>
    <div className="text-lg text-white/70">
      {children || <p>{description}</p>}
    </div>
  </div>
);

const FeaturesSection: React.FC = () => {
  return (
    <section className="relative w-full bg-[#0c0814] py-16 sm:py-24">
      <PixelBackdrop />
      
        <div className="px-8">
        <div className="grid gap-20 lg:gap-28">
          <FeatureRow title="AI Powered Paper Recommendations">
            <FeaturePreview
              imageUrl="./ask_ai.png" // IMPORTANT: Replace with your screenshot
              linkUrl="/ask" // IMPORTANT: Replace with the correct page URL
                linkText="Get recommendations"
            />
          </FeatureRow>

          <FeatureRow title="Save and explore your favorite papers">
             <FeaturePreview 
              imageUrl="./saved_papers.png" // IMPORTANT: Replace with your screenshot
              linkUrl="/saved" // IMPORTANT: Replace with the correct page URL
              linkText="See all saved papers"
            />
          </FeatureRow>
          
          <FeatureRow title="Here are all the papers in our database">
            <FeaturePreview 
              imageUrl="./all_papers.png" // IMPORTANT: Replace with your screenshot
              linkUrl="/all-papers" // IMPORTANT: Replace with the correct page URL
              linkText="See all papers"
            />
          </FeatureRow>

          <FeatureRow title="Browse Insights on Space Biology Research">
             <FeaturePreview 
              imageUrl="./insights.png"
              linkUrl="/insights"
              linkText="View insights"
            />
          </FeatureRow>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;