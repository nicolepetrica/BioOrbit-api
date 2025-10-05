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
