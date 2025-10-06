import type { ChatResponse } from "../types/chat.ts";

const API_URL = import.meta.env.VITE_CHAT_API_URL;



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

export type AnswerResponse = {
  ok?: boolean;
  answer: string;
  source?: any[];
};

const ANSWERS_URL =
  import.meta.env.VITE_ANSWERS_URL || "/api/query"; // if using Vite proxy

export async function askBackend(
  question: string,
  signal?: AbortSignal
): Promise<AnswerResponse> {
  console.log("[askBackend] POST", ANSWERS_URL, { question });

  const res = await fetch(ANSWERS_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
    signal, // ✅ proper AbortSignal
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error("Invalid JSON:", text);
    throw new Error("Invalid JSON from server");
  }

  if (!res.ok || data?.ok === false) {
    const msg =
      data?.detail?.[0]?.msg ||
      data?.message ||
      `Answers API ${res.status}`;
    throw new Error(msg);
  }

  return {
    ok: data.ok ?? true,
    answer: data.answer ?? "",
    source: Array.isArray(data.source) ? data.source : [],
  };
}
