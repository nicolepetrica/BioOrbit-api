import fs from "fs";
import path from "path";
import { csvParse } from "d3-dsv";
import fetch from "node-fetch";

const csvPath = path.resolve("public/papers_enriched.csv");
const outPath = path.resolve("public/citation_edges.csv");

// adjust this to match your actual column name
const DOI_COLUMN = "DOI";

async function main() {
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = csvParse(text);
  const dois = Array.from(
    new Set(
      rows
        .map((r) => (r as any)[DOI_COLUMN]?.trim()?.toLowerCase())
        .filter((d) => !!d)
    )
  );

  console.log(`Found ${dois.length} unique DOIs`);
  if (dois.length === 0) return;

  const results: { source: string; target: string }[] = [];

  for (const doi of dois) {
    const safe = encodeURIComponent(doi);
    const url = `https://api.crossref.org/works/${safe}`;
    console.log("Fetching", doi);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(resp.statusText);
      const data = await resp.json();
      const refs = data?.message?.reference || [];
      for (const r of refs) {
        if (!r?.DOI) continue;
        results.push({ source: doi, target: String(r.DOI).toLowerCase() });
      }
    } catch (err) {
      console.warn("Failed for", doi, err);
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  // build CSV
  const lines = ["source,target", ...results.map((r) => `${r.source},${r.target}`)];
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`Saved ${results.length} edges to ${outPath}`);
}

main();
