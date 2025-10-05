// src/pages/components/PaperCard.tsx
import React from "react";
import type { Paper } from "../lib/papers";

export default function PaperCard({
  p,
  isSaved,
  onToggleSave,
  index,
}: {
  p: Paper;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  index: number | null;
}) {
  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 flex flex-col justify-between hover:bg-white/[0.07] transition-all">
      <div>
        <h3 className="text-lg font-semibold text-white">{p.title}</h3>
        {p.authors && (
          <p className="mt-2 text-white/60 text-sm line-clamp-2">{p.authors}</p>
        )}
        {p.year && (
          <p className="mt-1 text-white/50 text-xs uppercase tracking-wide">
            {p.journal ? `${p.journal}, ` : ""}
            {p.year}
          </p>
        )}
        {p.keywords && (
          <p className="mt-3 text-white/60 text-sm italic line-clamp-2">
            {p.keywords}
          </p>
        )}
      </div>

      {/* Action bar */}
      <div className="mt-6 flex items-center justify-between">
        {/* Open button */}
        <a
          href={p.link || p.doi}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-violet-300 text-slate-950 font-semibold rounded-xl text-sm hover:brightness-105 transition-all"
        >
          Open
        </a>

        {/* Bookmark button */}
        <button
          onClick={() => onToggleSave(p.id)}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
            isSaved
              ? "bg-violet-300 text-slate-950 hover:brightness-105"
              : "bg-white/10 text-white/80 hover:bg-white/20"
          }`}
        >
          <div className="relative">
            <img
              src="/icons/bookmark.svg"
              alt="bookmark"
              className={`w-5 h-5 ${isSaved ? "brightness-100" : "opacity-80"}`}
            />
            {index && (
              <span className="absolute -top-2 -right-2 bg-violet-500 text-white text-[10px] rounded-full px-1">
                {index}
              </span>
            )}
          </div>
          {isSaved ? "Saved" : "Bookmark"}
        </button>
      </div>
    </div>
  );
}
