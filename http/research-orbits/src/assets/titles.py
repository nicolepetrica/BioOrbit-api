#!/usr/bin/env python3
import argparse
import csv
import os
import subprocess
import sys
from pathlib import Path

def find_project_root() -> Path:
    root = Path.cwd()
    for _ in range(6):
        if (root / "package.json").exists():
            return root
        root = root.parent
    return Path.cwd()

def run_pdftoppm(pdf_path: Path, out_png: Path, max_width=900, max_height=1200):
    out_base = out_png.with_suffix("")  # pdftoppm adds .png itself if not singlefile
    out_base.parent.mkdir(parents=True, exist_ok=True)

    # Use -singlefile so we get exactly one PNG (first page)
    # Use -scale-to to constrain the larger dimension
    # We’ll pick the smaller of the two scales so the result fits max_w x max_h.
    # First, probe page size via pdfinfo
    try:
        info = subprocess.run(
            ["pdfinfo", str(pdf_path)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
        ).stdout
        w_pt, h_pt = None, None
        for line in info.splitlines():
            if line.startswith("Page size:"):
                # Example: "Page size:      612 x 792 pts (letter)"
                parts = line.split()
                for i, t in enumerate(parts):
                    if t.isdigit() and parts[i+1] == "x" and parts[i+2].isdigit():
                        w_pt = float(t)
                        h_pt = float(parts[i+2])
                        break
                if w_pt and h_pt:
                    break
    except Exception:
        w_pt, h_pt = None, None

    scale_to = None
    if w_pt and h_pt:
        sx = max_width / w_pt
        sy = max_height / h_pt
        scale_to = int(max(1, min(sx, sy) * max(w_pt, h_pt)))
    else:
        # Fallback if pdfinfo not available; a safe default
        scale_to = max(max_width, max_height)

    cmd = [
        "pdftoppm",
        "-png",
        "-singlefile",
        "-f", "1",
        "-l", "1",
        "-scale-to", str(scale_to),
        str(pdf_path),
        str(out_base)
    ]
    print(f"  • pdftoppm: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    # pdftoppm will produce file as out_base + ".png"
    produced = out_base.with_suffix(".png")
    if produced != out_png:
        produced.rename(out_png)

def main():
    parser = argparse.ArgumentParser(description="Make PNG thumbnails (first page) for PDFs using pdftoppm.")
    parser.add_argument("--papers-dir", default=None, help="Where PDFs live. Default: public/assets/papers or src/assets/papers")
    parser.add_argument("--out-dir", default=None, help="Where thumbnails go. Default: public/assets/paper_thumbs")
    parser.add_argument("--csv-out", default=None, help="CSV: pdf,thumb. Default: public/assets/papers_thumbnails.csv")
    parser.add_argument("--glob", default="**/*.pdf", help="PDF glob (default: **/*.pdf)")
    parser.add_argument("--max-width", type=int, default=900)
    parser.add_argument("--max-height", type=int, default=1200)
    args = parser.parse_args()

    root = find_project_root()
    public_dir = root / "public"
    src_dir = root / "src"

    # Prefer public/assets/papers; fall back to src/assets/papers
    default_papers = public_dir / "assets" / "papers"
    if not default_papers.exists():
        alt = src_dir / "assets" / "papers"
        default_papers = alt

    papers_dir = Path(args.papers_dir).resolve() if args.papers_dir else default_papers.resolve()
    thumbs_dir = Path(args.out_dir).resolve() if args.out_dir else (public_dir / "assets" / "paper_thumbs").resolve()
    csv_out = Path(args.csv_out).resolve() if args.csv_out else (public_dir / "assets" / "papers_thumbnails.csv").resolve()

    print(f"[i] Project root : {root}")
    print(f"[i] PDFs dir     : {papers_dir}")
    print(f"[i] Thumbs dir   : {thumbs_dir}")
    print(f"[i] CSV out      : {csv_out}")

    if not papers_dir.exists():
        print(f"[!] PDFs dir does not exist: {papers_dir}", file=sys.stderr)
        sys.exit(1)

    pdfs = sorted(papers_dir.glob(args.glob))
    if not pdfs:
        print(f"[!] No PDFs found with pattern {args.glob} under {papers_dir}", file=sys.stderr)
        sys.exit(1)

    thumbs_dir.mkdir(parents=True, exist_ok=True)
    csv_out.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for i, pdf in enumerate(pdfs, 1):
        rel = pdf.relative_to(papers_dir).with_suffix(".png")
        out_png = thumbs_dir / rel
        try:
            print(f"[{i}/{len(pdfs)}] {pdf.name}")
            run_pdftoppm(pdf, out_png, args.max_width, args.max_height)
            web_pdf = f"/assets/papers/{rel.with_suffix('.pdf').as_posix()}"
            web_thumb = f"/assets/paper_thumbs/{rel.as_posix()}"
            rows.append({"pdf": web_pdf, "thumb": web_thumb})
        except subprocess.CalledProcessError as e:
            print(f"  ! pdftoppm error: {e}", file=sys.stderr)
        except Exception as e:
            print(f"  ! error: {e}", file=sys.stderr)

    with csv_out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pdf", "thumb"])
        w.writeheader()
        w.writerows(rows)

    print(f"[✓] Wrote {len(rows)} rows -> {csv_out}")
    print("    Example row:")
    if rows:
        print(f"    {rows[0]['pdf']}, {rows[0]['thumb']}")

if __name__ == "__main__":
    # Make sure poppler-utils is installed and pdftoppm is on PATH
    if not any((Path(p) / "pdftoppm").exists() for p in os.getenv("PATH", "").split(os.pathsep)):
        print("[!] pdftoppm not found. Install poppler-utils (e.g., sudo apt-get install poppler-utils).", file=sys.stderr)
    main()
