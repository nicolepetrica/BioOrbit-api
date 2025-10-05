import React from "react";

type PillOption = {
  key: string;
  label: string;
};

export default function ButtonPill({
  options,
  selected,
  onSelect,
}: {
  options: PillOption[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  return (
    <div
      className="
        inline-flex items-center
        rounded-full overflow-hidden
        bg-slate-950 shadow-[4px_4px_20px_0px_rgba(201,182,247,0.20)]
      "
    >
      {options.map((opt, i) => {
        const isFirst = i === 0;
        const isLast = i === options.length - 1;
        const isActive = selected === opt.key;

        // Only round the *outer* edge for the active tab
        const activeRadius =
          isFirst ? "rounded-l-full" : isLast ? "rounded-r-full" : "rounded-none";

        return (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            className={[
              "px-6 py-2.5 font-['Inter'] font-bold text-base transition-all duration-200",
              // base (no inner rounding, no spacing)
              "rounded-none",
              // active vs idle
              isActive
                ? `bg-violet-300 text-slate-950 ${activeRadius}`
                : "bg-transparent text-white hover:bg-slate-800",
              // remove default button styles that could affect shape
              "focus:outline-none",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
