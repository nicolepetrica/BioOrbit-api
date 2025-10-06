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
    console.error("Invalid JSON response:", raw);
  }

  if (!res.ok) {
    const detail =
      (Array.isArray(data?.detail) &&
        data.detail.map((d: any) => `${d?.msg ?? "error"} (${d?.type ?? "unknown"})`).join("; ")) ||
      raw ||
      res.statusText;
    throw new Error(`Similarity API ${res.status}: ${detail}`);
  }

  // Expected: { results: [ { id, title, year, score }, ... ] }
  const items: any[] = Array.isArray(data?.results) ? data.results : [];

  const source = items.map((it) => ({
    title: it?.title ?? "(untitled)",
    link: undefined, // will be filled in UI using CSV
    journal: undefined,
    year: it?.year ?? undefined,
    authors: "",
    keywords: [],
    doi: undefined,
    score: typeof it?.score === "number" ? it.score : undefined, // ✅ keep score
  }));

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
