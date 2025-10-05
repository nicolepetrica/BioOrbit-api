// src/lib/papersIndex.ts
// Loads /public/papers_enriched.csv and builds a Map<title_norm, fullTextLink|link>

let _indexPromise: Promise<Map<string, string>> | null = null;

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

// tiny CSV parser that handles quotes and commas inside quotes
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch === "\r") { /* ignore \r; handle on \n */ }
      else cell += ch;
    }
  }
  // flush last cell/row
  row.push(cell);
  rows.push(row);
  return rows.filter(r => !(r.length === 1 && r[0] === "")); // drop trailing blank
}

export async function loadPapersIndex(csvUrl = "/papers_enriched.csv") {
  if (_indexPromise) return _indexPromise;

  _indexPromise = (async () => {
    const resp = await fetch(csvUrl);
    if (!resp.ok) throw new Error(`Failed to load ${csvUrl}: ${resp.status}`);
    const text = await resp.text();

    const rows = parseCSV(text);
    if (!rows.length) return new Map<string, string>();

    const header = rows[0];
    const data = rows.slice(1);

    // Find column indices
    const colTitle = header.findIndex(h => h.trim().toLowerCase() === "title");
    const colLink1 = header.findIndex(h => h.trim().toLowerCase() === "full text link");
    const colLink2 = header.findIndex(h => h.trim().toLowerCase() === "link");

    const map = new Map<string, string>();
    for (const r of data) {
      const title = r[colTitle] ?? "";
      const link = r[colLink1] || r[colLink2] || "";
      if (!title || !link) continue;
      map.set(norm(title), link);
    }
    return map;
  })();

  return _indexPromise;
}

export async function resolveLinkByTitle(title: string): Promise<string | undefined> {
  const idx = await loadPapersIndex();
  return idx.get(norm(title));
}
