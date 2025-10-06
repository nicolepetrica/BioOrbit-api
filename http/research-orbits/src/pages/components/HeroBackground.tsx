// src/components/HeroBackground.tsx
import React from 'react';

const HeroBackground = () => {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden blur-100 opacity-50">
      {/* Large dark purple circle (top center) */}
      <div 
        className="absolute -top-1/4 left-1/2 -translate-x-1/2 h-[32rem] w-[32rem] rounded-full bg-indigo-900/60" 
      />
      {/* Large dark purple circle (bottom left) */}
      <div 
        className="absolute -bottom-1/4 left-1/4 -translate-x-1/2 h-[30rem] w-[30rem] rounded-full bg-indigo-900/50" 
      />
      {/* Medium lavender circle (top right) */}
      <div 
        className="absolute top-[5%] right-[20%] h-48 w-48 rounded-full bg-purple-400/70" 
      />
      {/* Small gold circle (middle left) */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 left-[15%] h-32 w-32 rounded-full bg-yellow-500/80" 
      />
      {/* Small dark purple circle (bottom left corner) */}
      <div 
        className="absolute bottom-[20%] left-[5%] h-20 w-20 rounded-full bg-indigo-900/70" 
      />
      {/* Small pink circle (middle right) */}
      <div 
        className="absolute top-1/2 -translate-y-1/4 right-[15%] h-16 w-16 rounded-full bg-pink-400/70" 
      />
      {/* Light grey circle (top right corner) */}
      <div 
        className="absolute top-[10%] right-[10%] h-32 w-32 rounded-full bg-gray-300/80" 
      />
      {/* Jupiter SVG */}
      <div className="absolute bottom-[5%] right-[10%] h-64 w-64">
        <img src="/jupiter.svg" alt="Decorative planet" className="h-full w-full" />
      </div>
    </div>
  );
};

export default HeroBackground;