// src/components/FeaturesSection.tsx
import React, { useMemo } from "react";
import FeaturePreview from "./FeaturePreview";

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
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.s}rem`,
            height: `${b.s}rem`,
            opacity: b.o,
          }}
        />
      ))}
    </div>
  );
}

const FeatureRow: React.FC<{
  title: React.ReactNode;
  children: React.ReactNode;
  reverse?: boolean;
  description?: string;
}> = ({ title, children, reverse, description = false }) => {
  const TitleColumn = (
    <div className="p-10">
      <h3 className="text-3xl font-bold tracking-tight text-white lg:text-4xl">
        {title}
      </h3>
      {/* Conditionally render the description if it exists */}
      {description && (
        <p className="mt-4 text-base text-gray-400">{description}</p>
      )}
    </div>
  );

  const ContentColumn = <div className="text-lg text-white/70">{children}</div>;
  return (
    <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
      {reverse ? (
        <>
          {ContentColumn}
          {TitleColumn}
        </>
      ) : (
        <>
          {TitleColumn}
          {ContentColumn}
        </>
      )}
    </div>
  );
};

const FeaturesSection: React.FC = () => {
  const features = [
    {
      title: (
        <>
          Browse Insights on <br /> Space Biology Research
        </>
      ),
      content: (
        <FeaturePreview
          imageUrl="./insights.png"
          linkUrl="/insights"
          linkText="View insights"
        />
      ),
      description:
        "Explore trends and insights in Space Biology research through interactive visualizations.",
    },
    {
      title: <>AI Powered Paper Recommendations</>,
      content: (
        <FeaturePreview
          imageUrl="./ask_ai.png"
          linkUrl="/ask"
          linkText="Get recommendations"
        />
      ),
      description:
        "Describe your paper, and our AI will recommend the most relevant publications to read and cite.",
    },
    {
      title: (
        <>
          Ask AI and get <br /> reliable answers
        </>
      ),
      content: (
        <FeaturePreview
          imageUrl="./saved_papers.png"
          linkUrl="/saved"
          linkText="See all saved papers"
        />
      ),
      description:
        "Ask our AI questions about Space Biology and get answers grounded in scientific literature.",
    },
    {
      title: (
        <>
          Save and explore <br /> your favorite papers
        </>
      ),
      content: (
        <FeaturePreview
          imageUrl="./all_papers.png"
          linkUrl="/all-papers"
          linkText="See all papers"
        />
      ),
      description:
        "Easily save and organize papers you find interesting for quick access later.",
    },
  ];

  return (
    <section className="relative w-full bg-[#0c0814] py-16 sm:py-24 overflow-hidden">
      <PixelBackdrop />

      <div className="px-8">
        <div className="grid gap-20 lg:gap-28">
          {features.map((feature, index) => (
            <FeatureRow
              key={index}
              title={feature.title}
              reverse={index % 2 !== 0}
              description={feature.description}
            >
              {feature.content}
            </FeatureRow>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
