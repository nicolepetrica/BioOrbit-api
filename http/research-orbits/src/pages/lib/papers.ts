// src/lib/papers.ts
import { csvParse } from "d3-dsv";

export type Paper = {
  id: string;
  title: string;
  abstract?: string;
  summary?: string;
  authors?: string;
  year?: string;
  pdf?: string;
  url?: string;
  concepts?: string[];
  venue?: string;
  doi?: string;
  citations?: string;
};

export const CSV_URL = "/papers_enriched.csv";

function firstValueByKeys(row: Record<string,string>, keys: string[]) {
  for (const k of keys) {
    const key = Object.keys(row).find(r => r.toLowerCase().trim() === k.toLowerCase().trim());
    const v = key ? String(row[key] ?? "").trim() : "";
    if (v) return v;
  }
}

function splitConcepts(raw?: string): string[]|undefined {
  if (!raw) return;
  let s = raw.trim();

  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(x => String(x).trim()).filter(Boolean).slice(0, 10);
    } catch {}
  }
  s = s.replace(/^[\[\(]+|[\]\)]+$/g, "");
  const parts = s.split(/[,;|]/g).map(x => x.replace(/^['"“‘]+|['"”’]+$/g, "").trim()).filter(Boolean);
  return parts.length ? parts.slice(0, 10) : undefined;
}

// build a stable-ish id (prefer DOI/url/pdf; fallback to title+year)
function makeId(args: {doi?:string; url?:string; pdf?:string; title:string; year?:string}) {
  const key = args.doi || args.url || args.pdf || `${args.title}::${args.year ?? ""}`;
  // simple hash
  let h = 0; for (let i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i))|0;
  return `p_${Math.abs(h)}`;
}

export function normalizeRow(row: Record<string,string>): Paper|null {
  const title =
    firstValueByKeys(row, ["title","paper_title","name"]) ||
    firstValueByKeys(row, ["articletitle","document title"]);
  if (!title) return null;

  const abstract =
    firstValueByKeys(row, ["abstract","description"]) ||
    firstValueByKeys(row, ["abstracttext"]);
  const summary = firstValueByKeys(row, ["summary"]);
  const authors = firstValueByKeys(row, ["authors","author","author_names","creators","contributors"]);
  const year = firstValueByKeys(row, ["year","pub_year","publicationyear","date","published","publication year"]);
  const pdf  = firstValueByKeys(row, ["pdf","pdf_url","pdfurl","file","path","localpdf"]);
  const url  = firstValueByKeys(row, ["url","link","paperurl","source_url","doi_url"]);
  const concepts = splitConcepts(firstValueByKeys(row, ["openalex concepts","concepts","keywords","tags"]));
  const venue = firstValueByKeys(row, ["venue","journal","source","publication","container_title"]);
  const doi = firstValueByKeys(row, ["doi"]);
  const citations = firstValueByKeys(row, ["citations","citedby_count","times_cited"]);

  const id = makeId({ doi, url, pdf, title, year });

  return { id, title, abstract, summary, authors, year, pdf, url, concepts, venue, doi, citations };
}

export async function loadPapers(): Promise<Paper[]> {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const text = await res.text();
  const rows = csvParse(text) as unknown as Array<Record<string,string>>;
  return rows.map(normalizeRow).filter((p): p is Paper => !!p);
}
