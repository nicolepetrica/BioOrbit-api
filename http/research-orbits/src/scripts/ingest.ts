// scripts/ingest.ts
//
// EXACT mapping for your CSV headers + correct endpoint:
//   POST http://localhost:8080/articles/upsert_many
//
// Payload per item:
//   { id: string, title: string, abstract: string, authors: string[], keywords: string[] }
//
// Run:
//   npm i axios csv-parse
//   npm i -D ts-node typescript @types/node
//   npx ts-node scripts/ingest.ts \
//     --csv ./papers_enriched.csv \
//     --url http://localhost:8080/articles/upsert_many
//
// Verbose (prints every row):
//   npx ts-node scripts/ingest.ts --csv ./papers_enriched.csv --verbose
//
// Notes:
// - Handles duplicated headers by renaming them "Header_2", "Header_3", etc.
// - Authors/Keywords splitting handles commas/semicolons/pipes.
// - If `Keywords` empty, falls back to `OpenAlex Concepts`.
//

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";
import axios from "axios";

type Row = Record<string, unknown>;

type Args = {
  csv: string;
  url: string;
  verbose: boolean;
};

function getArg(flag: string, def?: string) {
  const i = process.argv.indexOf(`--${flag}`);
  if (i >= 0) {
    if (process.argv[i + 1]?.startsWith("--")) return def; // boolean flag
    return process.argv[i + 1] ?? def;
  }
  return def;
}

function hasFlag(flag: string) {
  return process.argv.includes(`--${flag}`);
}

function uniqueColumns(headers: string[]): string[] {
  const seen: Record<string, number> = {};
  return headers.map((hRaw) => {
    const h = hRaw.trim();
    const n = (seen[h] = (seen[h] ?? 0) + 1);
    return n === 1 ? h : `${h}_${n}`;
  });
}

function pickFirstPresent(row: Row, candidates: string[]): string | undefined {
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, c)) return c;
  }
  return undefined;
}

function getFirstNonEmpty(row: Row, candidates: string[]): string {
  for (const c of candidates) {
    const v = row[c];
    if (v != null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "";
}

function toList(raw: string): string[] {
  if (!raw) return [];
  // Normalize bracketed strings like "['A', 'B']"
  let s = raw.trim();
  s = s.replace(/^\[|\]$/g, "");
  // Split on commas/semicolons/pipes
  const parts = s.split(/[,;|]/g).map((p) => p.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
  return parts;
}

async function main() {
  const args: Args = {
    csv: getArg("csv", "./papers_enriched.csv")!,
    url: getArg("url", "http://localhost:8080/articles/upsert_many")!,
    verbose: hasFlag("verbose"),
  };

  console.log("[CFG] csv:", args.csv);
  console.log("[CFG] url:", args.url);
  console.log("[CFG] verbose:", args.verbose);

  const csvPath = path.resolve(args.csv);
  if (!fs.existsSync(csvPath)) {
    console.error("[ERR] CSV not found:", csvPath);
    process.exit(1);
  }

  console.log("[IO] Reading CSV…");
  const raw = fs.readFileSync(csvPath, "utf-8");

  console.log("[CSV] Parsing with duplicate-header handling…");
  const rows: Row[] = parse(raw, {
    columns: (header) => uniqueColumns(header as string[]),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  if (!rows.length) {
    console.warn("[WARN] CSV is empty.");
    return;
  }

  // Show detected columns (from first row)
  const cols = Object.keys(rows[0] || {});
  console.log("[CSV] Columns:", cols);

  // EXACT header mapping with fallbacks for duplicates:
  const titleCols = ["Title"];
  const abstractCols = ["TLDR Summary", "TLDR Summary_2"];
  const authorsCols = ["Authors", "Authors_2"];
  const keywordsCols = ["Keywords", "Keywords_2"];
  const conceptsCols = ["OpenAlex Concepts", "OpenAlex Concepts_2"]; // fallback if Keywords empty

  // Validate required columns exist (at least primary)
  const firstRow = rows[0];
  const titleCol = pickFirstPresent(firstRow, titleCols);
  const absCol = pickFirstPresent(firstRow, abstractCols);
  const authorsCol = pickFirstPresent(firstRow, authorsCols);
  const keywordsCol = pickFirstPresent(firstRow, keywordsCols);
  const openAlexCol = pickFirstPresent(firstRow, conceptsCols); // optional

  console.log("[MAP] Title ->", titleCol ?? "(missing)");
  console.log("[MAP] Abstract (TLDR Summary) ->", absCol ?? "(missing)");
  console.log("[MAP] Authors ->", authorsCol ?? "(missing)");
  console.log("[MAP] Keywords ->", keywordsCol ?? "(missing)");
  console.log("[MAP] OpenAlex Concepts (fallback) ->", openAlexCol ?? "(none)");

  if (!titleCol) {
    console.error("[ERR] Required column 'Title' not found.");
    process.exit(1);
  }
  if (!absCol) {
    console.error("[ERR] Required column 'TLDR Summary' not found (neither primary nor duplicate).");
    process.exit(1);
  }
  if (!authorsCol) {
    console.error("[ERR] Required column 'Authors' not found.");
    process.exit(1);
  }
  // Keywords is allowed to be empty in the CSV; we’ll fallback to OpenAlex Concepts if available.

  console.log("[BUILD] Converting rows to API schema…");
  const payload = rows.map((row, idx) => {
    const id = String(idx + 1);

    const title = getFirstNonEmpty(row, titleCols);
    const abstract = getFirstNonEmpty(row, abstractCols);

    const authorsRaw = getFirstNonEmpty(row, authorsCols);
    const authors = toList(authorsRaw);

    let keywordsRaw = getFirstNonEmpty(row, keywordsCols);
    let keywords = toList(keywordsRaw);
    if (keywords.length === 0 && openAlexCol) {
      const fallbackRaw = getFirstNonEmpty(row, conceptsCols);
      keywords = toList(fallbackRaw);
    }

    if (args.verbose || idx < 5) {
      console.log(`\n[ROW ${idx + 1}] id=${id}`);
      console.log(`[ROW ${idx + 1}] title="${title.slice(0, 80)}"`);
      console.log(`[ROW ${idx + 1}] abstract.len=${abstract.length}`);
      console.log(`[ROW ${idx + 1}] authors(${authors.length})=`, authors);
      console.log(`[ROW ${idx + 1}] keywords(${keywords.length})=`, keywords);
    }

    return { id, title, abstract, authors, keywords };
  });

  console.log(`\n[BUILD] Built ${payload.length} items.`);

  console.log("[HTTP] Posting to", args.url);
  try {
    const res = await axios.post(args.url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 120_000,
    });
    console.log("[HTTP OK] status:", res.status);
    console.log("[HTTP OK] response keys:", Object.keys(res.data ?? {}));
    console.log("[HTTP OK] sample response:", JSON.stringify(res.data, null, 2).slice(0, 500));
  } catch (err: any) {
    console.error("[HTTP ERR] status:", err?.response?.status);
    if (err?.response?.data) {
      console.error("[HTTP ERR] body:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("[HTTP ERR] message:", err?.message);
    }
    process.exit(1);
  }

  console.log("[DONE] Ingestion finished.");
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
