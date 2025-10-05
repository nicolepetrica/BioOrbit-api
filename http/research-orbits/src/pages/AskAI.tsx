// AskAI.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import ChatInput from "./components/ChatInput";
import SourceCard from "./components/SourceCard";
import { fetchTopKSimilar } from "./lib/chatLib";

// ---------- types ----------
type Role = "user" | "assistant";
type Source = {
  title: string;
  link?: string;         // we fill from CSV's "Link" column
  journal?: string;
  year?: number | string;
  authors?: string;
  keywords?: string[];
  tldr?: string;
  doi?: string;
};
type ChatResponse = { answer?: string; source?: Source[] };
type Msg = { id: string; role: Role; text?: string; sources?: Source[]; loading?: boolean; error?: string | null };
// at top-level in AskAI()
const [composerH, setComposerH] = useState<number>(120); // default guess

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
    const title = r[colTitle]?.trim();
    const link  = r[colLink]?.trim();
    if (title && link) map.set(norm(title), link);
  }
  return map;
}

// ---------- page ----------
export default function AskAI() {
  // chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  // number of results (formerly “k / k-means”)
  const [numArticles, setNumArticles] = useState<number>(5);

  // CSV index
  const [indexReady, setIndexReady] = useState(false);
  const titleToLinkRef = useRef<Map<string, string>>(new Map());

  // misc
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load CSV index once
  useEffect(() => {
    let mounted = true;
    buildTitleToLinkIndex("/papers_enriched.csv")
      .then((idx) => { if (!mounted) return; titleToLinkRef.current = idx; setIndexReady(true); })
      .catch(() => setIndexReady(false));
    return () => { mounted = false; };
  }, []);

  // autoscroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const copy = useMemo(() => ({
    heading: "Paper Recommendations",
    sub: "Paste an abstract or describe your topic; we’ll retrieve the most similar papers.",
    placeholder: "Paste an abstract or describe the research topic",
    emptyHint: "Try: “microgravity bone loss countermeasures in mice models.”",
  }), []);

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
    add({ id: aid, role: "assistant", text: "Finding similar papers…", loading: true });

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res: ChatResponse = await fetchTopKSimilar(q, numArticles, ac.signal);

      // enrich with published Link from CSV by title
      const enriched: Source[] = await Promise.all(
        (res.source || []).map(async (s) => {
          const fromCsv = s.title ? titleToLinkRef.current.get(norm(s.title)) : undefined;
          return { ...s, link: fromCsv || s.link };
        })
      );

      patch(aid, {
        loading: false,
        text: res.answer || `Top ${enriched.length} articles for: “${q}”.`,
        sources: enriched,
      });
    } catch (e: any) {
      patch(aid, {
        loading: false,
        error: e?.message || "Something went wrong.",
        text: "Sorry, I couldn’t retrieve recommendations.",
      });
    }
  }

  return (
    <main className="h-screen w-screen bg-[#0c0814] text-white flex flex-col">
      <Navbar />

      {/* CHAT AREA (fills screen, no side blank space) */}
      <section className="flex-1 w-full flex flex-col">
        {/* header */}
        <div className="px-6 pt-8 pb-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-[clamp(22px,3.8vw,36px)] font-extrabold">{copy.heading}</h1>
            <p className="mt-2 text-white/80">{copy.sub}</p>
          </div>
        </div>

      {/* scrollable message list */}
      <div
        className="flex-1 overflow-y-auto px-6"
        style={{ paddingBottom: composerH + 20 }}   // <-- keeps last message visible above bar
      >
        <div className="max-w-3xl mx-auto">
          <div className="mt-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="mt-20 text-center text-white/60">{copy.emptyHint}</div>
            )}
            {messages.map((m) => <Bubble key={m.id} msg={m} />)}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      </section>

      {/* BOTTOM: input bar + Number of articles control */}
      <BottomBar
        numArticles={numArticles}
        setNumArticles={setNumArticles}
        onSubmit={handleAsk}
        placeholder={copy.placeholder}
        onHeightChange={setComposerH}
      />
    </main>
  );
}

/* message bubble */
function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const shell = isUser ? "bg-white/10 ring-white/15" : "bg-white/5 ring-white/10";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl ring-1 ${shell} p-4`}>
        {msg.text && (
          <p className={`${isUser ? "text-white" : "text-white/90"} whitespace-pre-wrap leading-relaxed`}>
            {msg.text}
          </p>
        )}
        {msg.loading && <div className="mt-1 text-sm text-white/60">Thinking…</div>}
        {msg.error && <div className="mt-2 text-sm text-red-300">{msg.error}</div>}
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {msg.sources.map((s, i) => (
              <SourceCard key={i} s={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BottomBar({
  numArticles,
  setNumArticles,
  onSubmit,
  placeholder,
  onHeightChange,                  // <-- NEW
}: {
  numArticles: number;
  setNumArticles: (n: number) => void;
  onSubmit: (q: string) => void;
  placeholder: string;
  onHeightChange: (h: number) => void;
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // Report height to parent whenever it changes (e.g., responsive, wrapping, etc.)
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const el = entries[0]?.target as HTMLDivElement;
      if (el) onHeightChange(el.offsetHeight);
    });
    ro.observe(wrapRef.current);
    // initial
    onHeightChange(wrapRef.current.offsetHeight || 120);
    return () => ro.disconnect();
  }, [onHeightChange]);

  return (
    <div className="fixed left-0 right-0 bottom-0 z-50">
      <div ref={wrapRef} className="max-w-3xl mx-auto px-4 pb-4">
        <div className="flex items-end gap-3">
          {/* Number of articles control */}
          <div className="mb-2 rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 w-[230px]">
            <label className="block text-xs text-white/70 mb-2">Number of articles</label>
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-white/10 ring-1 ring-white/10 px-2 py-1 text-sm"
                onClick={() => setNumArticles(Math.max(1, numArticles - 1))}
                aria-label="Decrease number of articles"
              >−</button>
              <input
                type="number" min={1} max={50}
                value={numArticles}
                onChange={(e) => setNumArticles(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-16 text-center rounded-md bg-white/5 ring-1 ring-white/10 px-2 py-1 text-sm"
              />
              <button
                className="rounded-md bg-white/10 ring-1 ring-white/10 px-2 py-1 text-sm"
                onClick={() => setNumArticles(Math.min(50, numArticles + 1))}
                aria-label="Increase number of articles"
              >+</button>
            </div>
          </div>

          {/* Composer (your existing ChatInput) */}
          <div className="flex-1">
            <div className="backdrop-blur-md bg-[#0c0814]/80 rounded-2xl ring-1 ring-white/10 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <ChatInput onSubmit={onSubmit} placeholder={placeholder} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

