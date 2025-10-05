// src/components/PaperCard.tsx
import React from "react";
import type { Paper } from "../lib/papers";

function Concepts({ items }: { items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.slice(0,8).map((c, i) => (
        <span key={`${c}-${i}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80" title={c}>
          {c}
        </span>
      ))}
    </div>
  );
}

export default function PaperCard({
  p,
  isSaved,
  onToggleSave,
}: {
  p: Paper;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
}) {
  const openHref = p.pdf || p.url;

  return (
    <article
      className={`rounded-2xl bg-white/5 ring-1 p-5 shadow-[inset_0_0_60px_rgba(255,255,255,0.045)] overflow-hidden
      ${isSaved ? "ring-purple-400/40" : "ring-white/10"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[clamp(16px,1.35vw,22px)] font-semibold line-clamp-2 break-words" title={p.title}>
          {p.title}
        </h3>

        <button
          type="button"
          onClick={() => onToggleSave(p.id)}
          className={`flex-shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border
            ${isSaved ? "bg-purple-500/20 border-purple-400/60" : "bg-white/5 border-white/15"}
            hover:bg-white/10`}
          title={isSaved ? "Remove bookmark" : "Bookmark"}
        >
          {isSaved ? "Bookmarked" : "Bookmark"}
        </button>
      </div>

      {(p.authors || p.year || p.venue) && (
        <p
          className="mt-1 text-white/70 text-sm overflow-hidden text-ellipsis whitespace-nowrap break-words max-w-full"
          title={[p.authors, p.year, p.venue].filter(Boolean).join(" • ")}
        >
          {p.authors && <span>{p.authors}</span>}
          {p.authors && (p.year || p.venue) ? " • " : ""}
          {p.year && <span>{p.year}</span>}
          {p.year && p.venue ? " • " : ""}
          {p.venue && <span>{p.venue}</span>}
        </p>
      )}

      {p.abstract && (
        <p className="mt-3 text-white/75 text-[clamp(13px,1.05vw,15px)] line-clamp-3 break-words" title={p.abstract}>
          {p.abstract}
        </p>
      )}

      {p.summary && (
        <p className="mt-3 text-white/85 text-[clamp(13px,1.05vw,15px)] line-clamp-5 break-words" title={p.summary}>
          <span className="font-semibold">Summary: </span>
          {p.summary}
        </p>
      )}

      <Concepts items={p.concepts} />

      {(p.doi || p.citations) && (
        <div className="mt-3 text-xs text-white/60 flex flex-wrap gap-x-4 gap-y-1">
          {p.doi && <span className="truncate" title={p.doi}><span className="text-white/70">DOI:</span> {p.doi}</span>}
          {p.citations && <span className="truncate" title={`${p.citations} citations`}><span className="text-white/70">Citations:</span> {p.citations}</span>}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {openHref ? (
          <a
            href={openHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Open
          </a>
        ) : (
          <span className="text-sm text-white/50">No link available</span>
        )}
        {p.pdf && (
          <a
            href={p.pdf}
            download
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Download PDF
          </a>
        )}
      </div>
    </article>
  );
}
