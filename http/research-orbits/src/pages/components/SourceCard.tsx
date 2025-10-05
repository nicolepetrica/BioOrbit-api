import React from "react";
import type { ChatSource } from "../types/chat";
import { ExternalLink } from "lucide-react";

export default function SourceCard({ s }: { s: ChatSource }) {
  return (
    <article className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 shadow-[inset_0_0_40px_rgba(255,255,255,0.04)]">
      <h4 className="text-[clamp(14px,1.1vw,18px)] font-semibold line-clamp-2">{s.title}</h4>

      {(s.journal || s.year) && (
        <p className="mt-1 text-white/70 text-sm">
          {s.journal}{s.journal && s.year ? " • " : ""}{s.year}
        </p>
      )}

      {s.authors && (
        <p className="mt-2 text-white/70 text-sm line-clamp-2" title={s.authors}>
          {s.authors}
        </p>
      )}

      {s.tldr && (
        <p className="mt-3 text-white/80 text-sm line-clamp-3">{s.tldr}</p>
      )}

      {s.keywords && (
        <div className="mt-3 flex flex-wrap gap-2">
          {String(s.keywords).split(/[;,|]/).slice(0,6).map((k, i) => (
            <span key={i} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/80">
              {k.trim()}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <a
          href={s.link || (s.doi ? `https://doi.org/${s.doi}` : "#")}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          Open <ExternalLink className="size-3.5" />
        </a>
        {s.doi && (
          <span className="text-xs text-white/50 truncate">{s.doi}</span>
        )}
      </div>
    </article>
  );
}
