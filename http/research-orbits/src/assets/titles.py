# src/scripts/titles.py
from __future__ import annotations
import csv
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Tuple

logging.getLogger("pdfminer").setLevel(logging.ERROR)

from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer, LTTextLine, LTChar

GLOB = "./papers/*.pdf"
OUT_CSV = "papers_index.csv"
MAX_PAGES = 2

BAD_PATTERNS = [
    r"^https?://",
    r"\bdoi\.org\b",
    r"^doi\b",
    r"^layout\s*\d+\b",
    r"\bpp?\s*\d+(\s*[–\-\.]{1,2}\s*\d+)?\b",
    r"^\s*\d+\s*(–|-|\.\.|to)\s*\d+\s*$",
    r"^\s*figure\s+\d+\b",
    r"^\s*table\s+\d+\b",
    r"^\s*contents\b",
    r"^\s*references\b",
    r"^\s*(correction|erratum)\b",
]
BAD_RE = [re.compile(p, re.I) for p in BAD_PATTERNS]

def is_bad_candidate(s: str) -> bool:
    s_norm = " ".join(s.split())
    if not s_norm or len(s_norm) < 10:
        return True
    if sum(ch.isdigit() for ch in s_norm) / max(1, len(s_norm)) > 0.25:
        return True
    for rx in BAD_RE:
        if rx.search(s_norm):
            return True
    return False

def clean_title(t: str) -> str:
    t = t.replace("\u00ad", "")
    t = re.sub(r"-\s*\n\s*", "-", t)
    t = re.sub(r"\s*\n\s*", " ", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    t = re.sub(r"[•·|:;,\-–—]+$", "", t).strip()
    return t

@dataclass
class LineCand:
    text: str
    fontsize: float
    y_top: float
    box_id: int

def iter_textlines(layout) -> Iterable[LineCand]:
    for box_idx, element in enumerate(layout):
        if isinstance(element, LTTextContainer):
            for obj in element:
                if isinstance(obj, LTTextLine):
                    text = obj.get_text()
                    fonts = [ch.size for ch in obj if isinstance(ch, LTChar)]
                    if not text.strip():
                        continue
                    fs = sum(fonts) / len(fonts) if fonts else 10
                    yield LineCand(clean_title(text), fs, getattr(obj, "y1", 0.0), box_idx)

def group_and_score(cands: List[LineCand]) -> List[Tuple[float, str]]:
    if not cands:
        return []
    cands = sorted(cands, key=lambda c: (c.fontsize, c.y_top), reverse=True)
    print(f"  Found {len(cands)} candidate lines")

    scored = []
    used = set()
    for i, c in enumerate(cands):
        if i in used:
            continue
        txt, fs, y = c.text, c.fontsize, c.y_top
        # try combining with next similar line
        for j in range(i + 1, min(i + 6, len(cands))):
            cj = cands[j]
            if j in used:
                continue
            if cj.box_id == c.box_id and abs(cj.fontsize - fs) < 1.0 and abs(cj.y_top - y) < 28:
                txt = clean_title(f"{txt} {cj.text}")
                used.add(j)
                break
        score = fs * 3.0 + (y / 100.0)
        if not is_bad_candidate(txt):
            scored.append((score, txt))
        used.add(i)
    return sorted(scored, key=lambda x: -x[0])

def filename_fallback(p: Path) -> str:
    name = re.sub(r"[_\-]+", " ", p.stem)
    return re.sub(r"\s{2,}", " ", name).strip().title()

def extract_title_from_pdf(pdf: Path) -> str:
    print(f"\nProcessing: {pdf.name}")
    try:
        cands = []
        for i, page_layout in enumerate(extract_pages(str(pdf), page_numbers=range(MAX_PAGES))):
            print(f"  → Extracting page {i+1}")
            cands.extend(list(iter_textlines(page_layout)))
        ranked = group_and_score(cands)
        if ranked:
            print(f"  ✔ Top candidate: {ranked[0][1]} (score {ranked[0][0]:.2f})")
            return ranked[0][1]
        print("  ⚠ No good candidate, using fallback")
        return filename_fallback(pdf)
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return filename_fallback(pdf)

def main():
    base = Path(__file__).parent
    pdfs = sorted((base / GLOB).resolve().parent.glob(Path(GLOB).name))
    if not pdfs:
        print("No PDFs found!")
        return
    out_csv = (base / OUT_CSV).resolve()
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for pdf in pdfs:
        title = extract_title_from_pdf(pdf)
        if is_bad_candidate(title):
            title = filename_fallback(pdf)
        rows.append({"title": title, "path": "/" + str(pdf).split("/src/", 1)[-1]})
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["title", "path"])
        w.writeheader()
        w.writerows(rows)
    print(f"\n✅ Wrote {len(rows)} titles to {out_csv}")

if __name__ == "__main__":
    main()
