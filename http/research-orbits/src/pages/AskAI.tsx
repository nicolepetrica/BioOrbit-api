import React, { useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import ChatInput from "./components/ChatInput";
import SourceCard from "./components/SourceCard";
import { askBackend } from "./lib/chatLib";
import type { ChatResponse } from "./types/chat";

export default function AskAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<ChatResponse["source"]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleAsk(q: string) {
    try {
      setLoading(true);
      setError(null);
      setAnswer("");
      setSources([]);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const res = await askBackend(q, ac.signal);
      setAnswer(res.answer || "");
      setSources(Array.isArray(res.source) ? res.source : []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const hasResult = !!answer || sources.length > 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />

      {/* Full-bleed section with a solid background layer to avoid any side bar */}
      <section className="relative w-screen overflow-hidden px-[40px] pt-10 pb-16">
        <div className="pointer-events-none absolute inset-0 bg-[#0c0814]" />

        <div className="relative z-10 mx-auto max-w-[1800px]">
          {/* Toggle-like header using Home button style */}
          <div className="flex items-center justify-center">
            <div className="inline-flex gap-2">
              <button
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                Get Answers
              </button>
              <button
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition"
              >
                Paper Recommendations
              </button>
            </div>
          </div>

          <div className="mt-10 text-center">
            <h1 className="text-[clamp(22px,3.8vw,36px)] font-extrabold">
              Get Answers, Backed by Research
            </h1>
            <p className="mt-3 text-white/80 max-w-[900px] mx-auto">
              Ask a question, and our AI will provide a reliable answer sourced
              from over 600 Space Biology publications.
            </p>
          </div>

          {/* Feature tiles */}
          <div className="mx-auto mt-10 grid max-w-[1200px] grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white/6 ring-1 ring-white/12 p-5 text-left">
              <p className="text-lg font-semibold">Explore trends and citation patterns</p>
              <p className="text-white/80">See how research developed through time</p>
            </div>
            <div className="rounded-2xl bg-white/6 ring-1 ring-white/12 p-5 text-left">
              <p className="text-lg font-semibold">Save your favorite papers and see how they relate</p>
              <p className="text-white/80">Build your own research map</p>
            </div>
          </div>

          {/* Input */}
          <div className="mx-auto mt-8 max-w-[1200px]">
            <ChatInput onSubmit={handleAsk} disabled={loading} />
          </div>

          {/* Results */}
          <div className="mx-auto mt-10 max-w-[1200px]">
            {loading && (
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 text-center text-white/70">
                Thinking…
              </div>
            )}

            {error && (
              <div className="rounded-2xl bg-red-500/10 ring-1 ring-red-400/30 p-6 text-center text-red-300">
                {error}
              </div>
            )}

            {hasResult && !loading && !error && (
              // Only create the two-column grid when we actually have results
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 text-left">
                  <h2 className="text-lg font-semibold mb-3">Answer</h2>
                  <p className="whitespace-pre-wrap leading-relaxed text-white/90">
                    {answer}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                  <h3 className="text-lg font-semibold mb-3">Sources</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {sources.map((s, i) => (
                      <SourceCard key={i} s={s} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!hasResult && !loading && !error && (
              <div className="mt-12 text-center text-white/60">
                Ask something like: <em>“How does microgravity affect osteoclast activity?”</em>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
