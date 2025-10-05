// src/components/FeaturePreview.tsx
import React from 'react';
import { ArrowRight } from 'lucide-react';

interface FeaturePreviewProps {
  imageUrl: string;
  linkUrl: string;
  linkText?: string;
}

const FeaturePreview: React.FC<FeaturePreviewProps> = ({ 
  imageUrl, 
  linkUrl,
  linkText = "go to page" 
}) => {
  return (
    <a 
      href={linkUrl}
      className="
        group relative block w-full h-48 md:h-64 
        overflow-hidden rounded-lg shadow-xl 
        border border-white/10 
        transition-all duration-300 
        hover:scale-105 hover:shadow-2xl hover:border-violet-400/50
      "
    >
      {/* The screenshot image */}
      <img 
        src={imageUrl} 
        alt="Feature preview" 
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      
      {/* A subtle dark overlay to make text more readable */}
      <div className="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover:bg-black/10" />

      {/* The "go to page" link */}
      <div className="absolute bottom-4 right-4">
        <div className="
          flex items-center gap-2 px-3 py-1.5 
          bg-white/90 text-gray-800 font-semibold text-sm 
          rounded-md shadow-lg
          transition-transform duration-300 
          group-hover:translate-x-1
        ">
          <span>{linkText}</span>
          <ArrowRight className="size-4" />
        </div>
      </div>
    </a>
  );
};

export default FeaturePreview;