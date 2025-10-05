// src/lib/papers.ts
import { csvParse } from "d3-dsv";

export type Paper = {
  id: string;
  title: string;
  abstract?: string;
  summary?: string;
  authors?: string;
  year?: number; // Changed to number for easier chart use
  pdf?: string;
  url?: string; // Used for "link" in bar chart popover
  concepts?: string[];
  venue?: string;
  doi?: string;
  openAlexCitations?: number; // Maps to "Citations (OpenAlex)"
  socialMediaMentions?: number; // Maps to "Social Media Mentions"
  mendeleyReaders?: number; // Maps to "Mendeley Readers"
  altmetricScore?: number; // Maps to "Altmetric Score"
};

export const CSV_URL = "/papers_enriched.csv";

function firstValueByKeys(row: Record<string,string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const key = Object.keys(row).find(r => r.toLowerCase().trim() === k.toLowerCase().trim());
    const v = key ? String(row[key] ?? "").trim() : "";
    if (v) return v;
  }
  return undefined;
}

function splitConcepts(raw?: string): string[]|undefined {
  if (!raw) return;
  let s = raw.trim();

  // Try JSON parsing first for robustness
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(x => String(x).trim()).filter(Boolean).slice(0, 10);
    } catch (e) {
      // Fallback to split if JSON parsing fails
      console.warn("JSON parse failed for concepts, falling back to split:", s, e);
    }
  }
  // Fallback split logic
  s = s.replace(/^[\[\(]+|[\]\)]+$/g, "");
  const parts = s.split(/[,;|]/g)
                 .map(x => x.replace(/^['"“‘]+|['"”’]+$/g, "").trim())
                 .filter(Boolean);
  return parts.length ? parts.slice(0, 10) : undefined;
}

function makeId(args: {doi?:string; url?:string; pdf?:string; title:string; year?:number}) {
  const key = args.doi || args.url || args.pdf || `${args.title}::${args.year ?? ""}`;
  let h = 0; for (let i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i))|0;
  return `p_${Math.abs(h)}`;
}

export function normalizeRow(row: Record<string,string>): Paper|null {
  const title =
    firstValueByKeys(row, ["title","paper_title","name"]) ||
    firstValueByKeys(row, ["articletitle","document title"]);
  if (!title) return null;

  const abstract = firstValueByKeys(row, ["abstract","description","abstracttext"]);
  const summary = firstValueByKeys(row, ["tldr summary", "summary"]);
  const authors = firstValueByKeys(row, ["authors","author","author_names","creators","contributors"]);

  const yearStr = firstValueByKeys(row, ["year","pub_year","publicationyear","date","published","publication year"]);
  const year = yearStr ? parseInt(yearStr, 10) : undefined;

  const pdf  = firstValueByKeys(row, ["pdf","pdf_url","pdfurl","file","path","localpdf"]);
  const url  = firstValueByKeys(row, ["url","link","paperurl","source_url","doi_url"]);
  const concepts = splitConcepts(firstValueByKeys(row, ["openalex concepts","concepts","keywords","tags","fields of study"]));
  const venue = firstValueByKeys(row, ["venue","journal","source","publication","container_title"]);
  const doi = firstValueByKeys(row, ["doi"]);

  // --- New metrics extraction ---
  const openAlexCitationsStr = firstValueByKeys(row, ["citations (openalex)","citations","citedby_count","times_cited"]);
  const openAlexCitations = openAlexCitationsStr ? parseFloat(openAlexCitationsStr) : undefined;

  const socialMediaMentionsStr = firstValueByKeys(row, ["social media mentions"]);
  const socialMediaMentions = socialMediaMentionsStr ? parseFloat(socialMediaMentionsStr) : undefined;

  const mendeleyReadersStr = firstValueByKeys(row, ["mendeley readers"]);
  const mendeleyReaders = mendeleyReadersStr ? parseFloat(mendeleyReadersStr) : undefined;

  const altmetricScoreStr = firstValueByKeys(row, ["altmetric score"]);
  const altmetricScore = altmetricScoreStr ? parseFloat(altmetricScoreStr) : undefined;
  // --- End new metrics extraction ---

  const id = makeId({ doi, url, pdf, title, year });

  return {
    id, title, abstract, summary, authors, year, pdf, url, concepts, venue, doi,
    openAlexCitations, socialMediaMentions, mendeleyReaders, altmetricScore
  };
}

export async function loadPapers(): Promise<Paper[]> {
  const res = await fetch(CSV_URL, { cache: "no-store" });
  const text = await res.text();
  const rows = csvParse(text) as unknown as Array<Record<string,string>>;
  return rows.map(normalizeRow).filter((p): p is Paper => !!p);
}