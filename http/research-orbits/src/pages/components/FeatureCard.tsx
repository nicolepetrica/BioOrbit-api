import React from "react";

export default function FeatureCard({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="
        relative group flex items-center
        min-h-[110px]
        rounded-2xl bg-white/5 ring-1 ring-white/10
        shadow-[inset_0_0_60px_rgba(255,255,255,0.045)]
        backdrop-blur-sm px-8 py-6
        transition-all duration-300
        hover:bg-white/8 hover:ring-white/20
      "
    >
      {/* Gradient glow effect */}
      <div
        className="
          absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
          transition-opacity duration-500 pointer-events-none
          before:absolute before:inset-[-2px] before:rounded-2xl
          before:bg-gradient-to-r before:from-purple-500/40 before:to-blue-500/40
          before:blur-[12px]
        "
      />

      {/* Content */}
      <div className="flex-shrink-0 w-10 flex justify-center relative z-10">
        <img src={icon} alt="" className="h-8 w-8 opacity-90" />
      </div>

      <div className="ml-6 text-left flex-1 relative z-10">
        <p className="font-normal text-[clamp(15px,1.25vw,20px)] leading-snug">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-white/70 text-[clamp(13px,1.05vw,16px)] leading-snug">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
