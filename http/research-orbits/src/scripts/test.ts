// scripts/build_citation_graph.ts
import { promises as fs } from "fs";
import path from "path";
import { loadPapers } from "/home/rideckszz/Documents/GitHub/NasaSpaceYags/http/research-orbits/src/lib/papers.ts";
import { buildCitationGraph } from "/home/rideckszz/Documents/GitHub/NasaSpaceYags/http/research-orbits/src/lib/citationGraph.ts";

(async () => {
  console.log("🚀 Starting citation graph build...");

  // 1. Load papers from CSV
  console.log("📥 Loading papers from CSV...");
  const papers = await loadPapers();
  console.log(`✅ Loaded ${papers.length} papers`);

  // 2. Collect DOIs
  const titlesByDoi: Record<string, string> = {};
  const seedDois = papers
    .map((p) => p.doi?.trim())
    .filter((d): d is string => !!d);

  for (const p of papers) {
    if (p.doi) titlesByDoi[p.doi] = p.title || p.doi;
  }

  console.log(`🧩 Found ${seedDois.length} DOIs`);
  console.log("🔍 Example DOIs:", seedDois.slice(0, 5));

  if (seedDois.length === 0) {
    console.error("❌ No DOIs found in CSV. Aborting.");
    process.exit(1);
  }

  // 3. Build the graph
  console.log("🛠 Building graph using Crossref/OpenAlex APIs...");
  try {
    const graph = await buildCitationGraph({
      seedDois,
      titlesByDoi,
      includeIncoming: true,
      maxPerSeed: 40,
      delayMs: 200,
      onProgress: (i, total, doi) =>
        console.log(`  🔄 [${i + 1}/${total}] Fetching citations for ${doi}`),
    });

    console.log(
      `✅ Graph built: ${graph.nodes.length} nodes • ${graph.links.length} edges`
    );

    // 4. Save file
    const outFile = path.resolve("public/citation_graph.json");
    await fs.writeFile(outFile, JSON.stringify(graph, null, 2));
    console.log(`💾 Saved graph to ${outFile}`);
  } catch (err: any) {
    console.error("❌ Error building graph:", err.message);
  }

  console.log("🏁 Done!");
})();