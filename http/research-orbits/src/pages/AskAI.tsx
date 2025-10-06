import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import ChatInput from "./components/ChatInput";
import SourceCard from "./components/SourceCard";
import ButtonPill from "./components/ButtonPill";
import { fetchTopKSimilar, askBackend } from "./lib/chatLib"; // POST {text,k} -> /similarity/topk_text

// ---------- local types ----------
type Role = "user" | "assistant";
type Source = {
  title: string;
  link?: string;         // from CSV "Link"
  journal?: string;
  year?: number | string;
  authors?: string;
  keywords?: string[];
  tldr?: string;
  doi?: string;
};
type Msg = {
  id: string;
  role: Role;
  text?: string;
  sources?: Source[];
  loading?: boolean;
  error?: string | null;
};

// ---------- tiny CSV loader (Title -> Link) ----------
const norm = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
  }
  row.push(cell); rows.push(row);
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

async function buildTitleToLinkIndex(csvUrl = "/papers_enriched.csv"): Promise<Map<string, string>> {
  const resp = await fetch(csvUrl);
  if (!resp.ok) throw new Error(`Failed to load ${csvUrl}: ${resp.status}`);
  const text = await resp.text();

  const rows = parseCSV(text);
  if (!rows.length) return new Map();

  const header = rows[0];
  const data = rows.slice(1);
  const colTitle = header.findIndex(h => h.trim().toLowerCase() === "title");
  const colLink  = header.findIndex(h => h.trim().toLowerCase() === "link");

  const map = new Map<string, string>();
  if (colTitle === -1 || colLink === -1) return map;

  for (const r of data) {
    const title = (r[colTitle] ?? "").trim();
    const link  = (r[colLink] ?? "").trim();
    if (title && link) map.set(norm(title), link);
  }
  return map;
}

// ---------- page ----------
export default function AskAI() {
  // Tabs
  const [tab, setTab] = useState<"answers" | "recommendations">("recommendations");

  // Chat messages
  const [messages, setMessages] = useState<Msg[]>([]);

  // Number of recommendations (formerly "k")
  const [numArticles, setNumArticles] = useState<number>(5);

  // CSV title->link index
  const [indexReady, setIndexReady] = useState(false);
  const titleToLinkRef = useRef<Map<string, string>>(new Map());

  // Composer height for ChatGPT-like layout (content never hides behind it)
  const [composerH, setComposerH] = useState<number>(120);

  // Misc
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load CSV index once
  useEffect(() => {
    let mounted = true;
    buildTitleToLinkIndex("/papers_enriched.csv")
      .then((idx) => { if (!mounted) return; titleToLinkRef.current = idx; setIndexReady(true); })
      .catch(() => setIndexReady(false));
    return () => { mounted = false; };
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, composerH]);

  const copy = useMemo(() => {
    const isAns = tab === "answers";
    return {
      heading: isAns ? "Get Answers" : "Paper Recommendations",
      sub: isAns
        ? "Ask a question; we’ll synthesize an answer grounded in the papers."
        : "Paste an abstract or describe your topic; we’ll retrieve the most similar papers.",
      placeholder: isAns
        ? "Ask a question to over 600 Space Biology publications"
        : "Paste an abstract or describe the research topic",
      emptyHint: isAns
        ? "Try: “How does microgravity affect bone remodeling?”"
        : "Try: “microgravity bone loss countermeasures in mice models.”",
    };
  }, [tab]);

  function add(m: Msg) { setMessages((prev) => [...prev, m]); }
  function patch(id: string, p: Partial<Msg>) { setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m))); }

  async function handleAsk(q: string) {
    if (!indexReady) {
      add({ id: crypto.randomUUID(), role: "assistant", text: "Loading paper index… please try again in a moment." });
      return;
    }

    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();

    add({ id: uid, role: "user", text: q });
    add({
      id: aid,
      role: "assistant",
      text: tab === "answers" ? "Preparing an answer…" : "Finding similar papers…",
      loading: true,
    });

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      if (tab === "answers") {
        // --- GET ANSWERS FLOW ---
        const res = await askBackend(q, ac.signal);
        patch(aid, {
          loading: false,
          text: res.answer || "No answer returned.",
          // If your answers API later returns structured sources, you can render them here
          sources: Array.isArray(res.source) ? res.source : [],
        });
      } else {
        // --- RECOMMENDATIONS FLOW ---
        const res = await fetchTopKSimilar(q, numArticles, ac.signal);

        // Enrich with published Link from CSV by title
        const enriched = await Promise.all(
          (res.source || []).map(async (s) => {
            const fromCsv = s.title
              ? titleToLinkRef.current.get(
                  s.title.toLowerCase().replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim()
                )
              : undefined;
            return { ...s, link: fromCsv || s.link };
          })
        );

        patch(aid, {
          loading: false,
          text: res.answer || `Top ${enriched.length} articles for: “${q}”.`,
          sources: enriched,
        });
      }
    } catch (e: any) {
      patch(aid, {
        loading: false,
        error: e?.message || "Something went wrong.",
        text: "Sorry, I couldn’t process that.",
      });
    }
  }


  return (
    <main className="h-screen w-screen bg-[#0c0814] text-white flex flex-col">
      <Navbar />

      {/* --- HEADER --- */}
      <div className="px-8 pt-6">
        <div className="max-w-[1600px] mx-auto">
          {/* Centered ButtonPill */}
          <div className="w-full flex justify-center mb-4">
            <ButtonPill
              options={[
                { key: "answers", label: "Get Answers" },
                { key: "recommendations", label: "Paper Recommendations" },
              ]}
              selected={tab}
              onSelect={(v) =>
                setTab(
                  (typeof v === "string" ? v : (v as any)?.key) === "answers"
                    ? "answers"
                    : "recommendations"
                )
              }
            />
          </div>

          <div className="text-center">
            <h1 className="text-[clamp(22px,3.8vw,36px)] font-extrabold">{copy.heading}</h1>
            <p className="mt-2 text-white/80">{copy.sub}</p>
          </div>
        </div>
      </div>

      {/* --- CHAT SCROLL AREA --- */}
      <div
        className="flex-1 overflow-y-auto px-8"
        style={{ paddingBottom: composerH + 80 }}
      >
        <div className="max-w-[1600px] mx-auto">
          <div className="flex gap-10">
            <div className="flex-1 max-w-[1300px]">
              <div className="mt-6 flex flex-col gap-4">
                {messages.length > 0 &&
                  messages.map((m) => <Bubble key={m.id} msg={m} />)}
                <div ref={bottomRef} />
              </div>
            </div>
            <aside className="w-[260px] hidden 2xl:block opacity-70" />
          </div>
        </div>
      </div>

      {/* --- BOTTOM COMPOSER --- */}
      <BottomBar
        numArticles={numArticles}
        setNumArticles={setNumArticles}
        onSubmit={handleAsk}
        placeholder={copy.placeholder}
        onHeightChange={setComposerH}
        hint={copy.emptyHint}
        showNumArticles={tab === "recommendations"}
      />
    </main>
  );
}

/* --- BUBBLE: smaller boxes --- */
function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const shell = isUser ? "bg-white/10 ring-white/15" : "bg-white/5 ring-white/10";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-xl ring-1 ${shell} p-3 text-sm leading-relaxed`}
      >
        {msg.text && (
          <p className={`${isUser ? "text-white" : "text-white/90"} whitespace-pre-wrap`}>
            {msg.text}
          </p>
        )}
        {msg.loading && <div className="mt-1 text-xs text-white/60">Thinking…</div>}
        {msg.error && <div className="mt-2 text-xs text-red-300">{msg.error}</div>}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {msg.sources.map((s, i) => (
              <SourceCard key={i} s={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- BOTTOM BAR --- */
function BottomBar({
  numArticles,
  setNumArticles,
  onSubmit,
  placeholder,
  onHeightChange,
  hint,
  showNumArticles,
}: {
  numArticles: number;
  setNumArticles: (n: number) => void;
  onSubmit: (q: string) => void;
  placeholder: string;
  onHeightChange: (h: number) => void;
  hint: string;
  showNumArticles: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const report = () => onHeightChange(wrapRef.current?.offsetHeight || 120);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(wrapRef.current);
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [onHeightChange]);

return (
    <div className="fixed left-0 right-0 bottom-0 z-50">
      <div className="max-w-[1600px] mx-auto px-8 pb-4" ref={wrapRef}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-10">
            <div className="flex-1 max-w-[1300px]">
              <div className="flex items-end gap-3">
                {showNumArticles && (  // ⬅️ only show in Recommendations
                  <div className="mb-2 rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 w-[260px]">
                    <label className="block text-xs text-white/70 mb-2">Number of articles</label>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-md bg-white/10 ring-1 ring-white/10 px-2 py-1 text-sm"
                        onClick={() => setNumArticles(Math.max(1, numArticles - 1))}
                      >−</button>
                      <input
                        type="number" min={1} max={50}
                        value={numArticles}
                        onChange={(e) =>
                          setNumArticles(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                        }
                        className="w-20 text-center rounded-md bg-white/5 ring-1 ring-white/10 px-2 py-1 text-sm"
                      />
                      <button
                        className="rounded-md bg-white/10 ring-1 ring-white/10 px-2 py-1 text-sm"
                        onClick={() => setNumArticles(Math.min(50, numArticles + 1))}
                      >+</button>
                    </div>
                  </div>
                )}

                {/* Composer */}
                <div className="flex-1">
                  <div className="backdrop-blur-md bg-[#0c0814]/80 rounded-2xl ring-1 ring-white/10 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                    <ChatInput onSubmit={onSubmit} placeholder={placeholder} />
                  </div>
                </div>
              </div>
            </div>
            <aside className="w-[260px] hidden 2xl:block" />
          </div>

          <div className="text-center text-white/50 text-sm">{hint}</div>
        </div>
      </div>
    </div>
  );
}
