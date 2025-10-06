// src/components/NasaChallengeFooter.tsx
import React from 'react';

const NasaChallengeFooter: React.FC = () => {
  return (
    // The main full-width footer bar with a violet background
    <footer className="w-full bg-violet-700 py-3">
      {/* A centered container to match your site's content width */}
      <div className="mx-auto max-w-6xl px-8">
        {/* Flex container to align the icon and text */}
        <div className="flex items-center gap-4">
          
          {/* Icon with its own slightly darker purple background */}
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-600 shadow-inner">
            <img 
              src="./icons/logo.svg" 
              alt="Challenge Logo" 
              className="h-full w-full"
            />
          </div>

          {/* The text */}
          <p className="font-semibold text-white">
            2025 Nasa Space Apps Challenge
          </p>
        </div>
      </div>
    </footer>
  );
};

export default NasaChallengeFooter;