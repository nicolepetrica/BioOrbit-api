import type { ChatResponse } from "../types/chat.ts";

const API_URL = import.meta.env.VITE_CHAT_API_URL;

export async function askBackend(query: string, signal?: AbortSignal): Promise<ChatResponse> {
  if (!API_URL) throw new Error("VITE_CHAT_API_URL is not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: query }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${txt || res.statusText}`);
  }
  // Backend returns:
  // { answer: "…", source: [{ title, link, journal, year, authors, keywords, tldr, doi }]}
  return res.json();
}

// lib/chatLib.ts

// Helper: map unknown API shapes to your SourceCard-friendly shape
function normalizeToSource(item: any) {
  const title =
    item?.title ??
    item?.paper_title ??
    item?.Title ??
    "(untitled)";

  const journal =
    item?.journal ??
    item?.Journal ??
    item?.journal_title ??
    item?.["Journal Title"] ??
    undefined;

  const year =
    item?.year ??
    item?.publication_year ??
    item?.["Publication Year"] ??
    undefined;

  const doi = item?.doi ?? item?.DOI ?? undefined;

  const link =
    item?.link ??
    item?.url ??
    item?.["Full Text Link"] ??
    (doi ? `https://doi.org/${String(doi)}` : undefined);

  // authors may be array or string
  const authorsRaw = item?.authors ?? item?.Authors ?? "";
  const authors =
    Array.isArray(authorsRaw)
      ? authorsRaw.join(", ")
      : String(authorsRaw || "");

  // keywords may be array or comma-separated string; also try OpenAlex concepts
  const kwRaw =
    item?.keywords ??
    item?.Keywords ??
    item?.openalex_concepts ??
    item?.["OpenAlex Concepts"] ??
    [];
  const keywords = Array.isArray(kwRaw)
    ? kwRaw
    : String(kwRaw || "")
        .replace(/^\[|\]$/g, "")
        .split(/[,;|]/g)
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);

  const tldr =
    item?.tldr ??
    item?.abstract ??
    item?.["TLDR Summary"] ??
    undefined;

  return { title, link, journal, year, authors, keywords, tldr, doi };
}


export async function fetchTopKSimilar(
  text: string,
  k: number,
  signal?: AbortSignal
): Promise<ChatResponse> {
  if (!API_URL) throw new Error("VITE_CHAT_API_URL is not set");
  const url = new URL("/similarity/topk_text", API_URL).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, k }),
    signal,
  });

  const raw = await res.text();
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    // keep raw text for error messages
  }

  if (!res.ok) {
    // FastAPI style errors: { detail: [{loc, msg, type}] }
    const detail =
      (Array.isArray(data?.detail) &&
        data.detail.map((d: any) => `${d?.msg ?? "error"} (${d?.type ?? "unknown"})`).join("; ")) ||
      raw ||
      res.statusText;
    throw new Error(`Similarity API ${res.status}: ${detail}`);
  }

  // Expected happy path per your example:
  // { results: [ { id: string, title: string, year: number | null, score: number }, ... ] }
  const items: any[] = Array.isArray(data?.results) ? data.results : [];

  // Map to your SourceCard-friendly shape
  const source = items.map((it) => {
    const title = it?.title ?? "(untitled)";
    const year = it?.year ?? undefined;
    const score = typeof it?.score === "number" ? it.score : undefined;

    // We don't have link/authors/keywords/doi in this response; leave them undefined/empty.
    return {
      title,
      link: undefined,
      journal: undefined,
      year,
      authors: "",
      keywords: [],
      tldr: typeof score === "number" ? `Similarity score: ${score.toFixed(3)}` : undefined,
      doi: undefined,
    };
  });

  const answer =
    source.length > 0
      ? `Top ${source.length} similar paper(s) for: “${text}”.`
      : "No similar papers found.";

  return { answer, source };
}
