import React, { useEffect, useRef, useState, useMemo } from "react";
import Navbar from "./components/Navbar";
import ChatInput from "./components/ChatInput";
import SourceCard from "./components/SourceCard";
import { askBackend } from "./lib/chatLib";
import type { ChatResponse } from "./types/chat";
import FeatureCard from "./components/FeatureCard";
import ButtonPill from "./components/ButtonPill";

export default function AskAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<ChatResponse["source"]>([]);
  const [selectedTab, setSelectedTab] = useState<"answers" | "recommendations">("answers");
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

      // same endpoint for now; just the UI text changes
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

  // ---- UI copy that switches with the pill ----
  const copy = useMemo(() => {
    const isAnswers = selectedTab === "answers";
    return {
      heading: isAnswers
        ? "Get Answers, Backed by Research"
        : "Find Paper Recommendations",
      sub: isAnswers
        ? "Ask a question, and our AI will provide a reliable answer sourced from over 600 Space Biology publications."
        : "Describe your research need or topic and we’ll recommend relevant papers from over 600 Space Biology publications.",
      inputPlaceholder: isAnswers
        ? "Ask a question to over 600 Space Biology publications"
        : "Describe what you’re researching (e.g., bone loss countermeasures in microgravity)",
      leftPanelTitle: isAnswers ? "Answer" : "Recommendations",
      rightPanelTitle: isAnswers ? "Sources" : "Suggested Sources",
      emptyHint: isAnswers
        ? "Ask something like: “How does microgravity affect osteoclast activity?”"
        : "Try something like: “Recent countermeasures for bone loss in microgravity.”",
    };
  }, [selectedTab]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c0814] text-white">
      <Navbar />

      <section className="relative w-screen overflow-hidden px-[40px] pt-10 pb-16">
        <div className="pointer-events-none absolute inset-0 bg-[#0c0814]" />

        <div className="relative z-10 mx-auto max-w-[1800px]">
          {/* Pills */}
          <div className="flex justify-center mb-10">
            <ButtonPill
              options={[
                { key: "answers", label: "Get Answers" },
                { key: "recommendations", label: "Paper Recommendations" },
              ]}
              selected={selectedTab}
              onSelect={(k) =>
                setSelectedTab(k as "answers" | "recommendations")
              }
            />
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="text-[clamp(22px,3.8vw,36px)] font-extrabold">
              {copy.heading}
            </h1>
            <p className="mt-3 text-white/80 max-w-[900px] mx-auto">
              {copy.sub}
            </p>
          </div>

          {/* Feature tiles (unchanged) */}
          <div className="mx-auto mt-10 grid max-w-[1200px] grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard
              icon="/icons/analytics.svg"
              title="Explore trends and citation patterns"
              subtitle="See how research developed through time"
            />
            <FeatureCard
              icon="/icons/network.svg"
              title="Save your favorite papers and see how they relate"
              subtitle="Build your own research map"
            />
          </div>

          {/* Chat input */}
          <div className="mx-auto mt-8 max-w-[1200px]">
            {/* If your ChatInput supports a placeholder prop, uncomment the line below:
                <ChatInput onSubmit={handleAsk} disabled={loading} placeholder={copy.inputPlaceholder} />
               Otherwise it’ll use its internal default. */}
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
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 text-left">
                  <h2 className="text-lg font-semibold mb-3">{copy.leftPanelTitle}</h2>
                  <p className="whitespace-pre-wrap leading-relaxed text-white/90">
                    {answer}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-6">
                  <h3 className="text-lg font-semibold mb-3">{copy.rightPanelTitle}</h3>
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
                {copy.emptyHint}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
