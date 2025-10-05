from mlx_lm import load, generate
import fitz  # PyMuPDF
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from colorama import Fore, Style, init
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
import re
import os
import time
from pathlib import Path
import json
from collections import Counter

# -----------------------
# Configuration
# -----------------------
CONFIG = {
    "data_dir": "./data",
    "summaries_dir": "./summaries",
    "model": "mlx-community/Qwen2.5-3B-Instruct-4bit",  # Larger model for better quality
    "max_tokens": 32000,
    "max_summary_tokens": 2048,  # Increased for comprehensive summaries
}


# -----------------------
# Helper Functions
# -----------------------
def is_already_summarized(doc: Document, summaries_dir: str) -> bool:
    """Check if a document has already been summarized"""
    filename = doc.metadata.get("filename", "")
    if not filename:
        return False
    
    base_name = os.path.splitext(filename)[0]
    summary_filename = f"summary_{base_name}.pdf"
    summary_path = os.path.join(summaries_dir, summary_filename)
    
    return os.path.exists(summary_path)


def clean_pdf_text(text: str) -> str:
    """Clean and normalize PDF text"""
    # De-hyphenate words split across lines
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    
    # Fix line breaks in the middle of sentences
    lines = text.splitlines()
    fixed_text = ""
    for line in lines:
        line = line.strip()
        if fixed_text and not fixed_text.endswith((".", "?", "!", ":", ";")):
            fixed_text += " " + line
        else:
            fixed_text += "\n" + line
    
    # Normalize whitespace
    fixed_text = re.sub(r'\s+', ' ', fixed_text)
    fixed_text = re.sub(r'\n+', '\n', fixed_text)
    
    return fixed_text.strip()


def estimate_tokens(text: str) -> int:
    """Rough estimation: ~1.3 tokens per word for English"""
    return int(len(text.split()) * 1.3)


def load_and_clean_pdfs(dir_path: str) -> list[Document]:
    """Load PDFs with proper page metadata"""
    docs = []
    pdf_files = [f for f in os.listdir(dir_path) if f.lower().endswith(".pdf")]
    
    print(Fore.YELLOW + f"Loading {len(pdf_files)} PDF files..." + Style.RESET_ALL)
    
    for filename in pdf_files:
        path = os.path.join(dir_path, filename)
        try:
            doc = fitz.open(path)
            
            title = doc.metadata.get("title", None)
            title = title if title else filename

            # Collect all pages with metadata
            pages_data = []
            for page_num, page in enumerate(doc):
                page_text = page.get_text()
                
                pages_data.append({
                    "title": title,
                    "text": page_text,
                    "page": page_num + 1
                })
            
            # Remove repeated header/footer lines
            line_counts = {}
            for page_data in pages_data:
                for line in page_data["text"].splitlines():
                    line_stripped = line.strip()
                    if line_stripped:
                        line_counts[line_stripped] = line_counts.get(line_stripped, 0) + 1
            
            common_lines = {line for line, count in line_counts.items() 
                          if count > len(pages_data) / 2 and len(line) < 100}
            
            # Clean pages and create documents with page metadata
            cleaned_document_text = ""
            for page_data in pages_data:
                cleaned_lines = [line for line in page_data["text"].splitlines() 
                               if line.strip() not in common_lines]
                page_text = "\n".join(cleaned_lines)
                cleaned_text = clean_pdf_text(page_text)
                
                if cleaned_text.strip():  # Only add non-empty pages
                    cleaned_document_text = cleaned_document_text + "\n\n" + cleaned_text

            docs.append(Document(
                    page_content=cleaned_document_text,
                    metadata={
                        "source": title,
                        "filename": filename,
                        "num_pages": len(pages_data)
                    }
                ))
        
            doc.close()
            print(Fore.GREEN + f"✓ Processed {title} ({len(pages_data)} pages)" + Style.RESET_ALL)
            
        except Exception as e:
            print(Fore.RED + f"✗ Error processing {filename}: {e}" + Style.RESET_ALL)
    
    return docs


def chunk_document(doc: Document, max_chunk_tokens: int = 20000) -> list[str]:
    """Split document into chunks if it exceeds token limit"""
    estimated_tokens = estimate_tokens(doc.page_content)
    
    if estimated_tokens <= max_chunk_tokens:
        return [doc.page_content]
    
    # Split into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=int(max_chunk_tokens / 1.5),  # Conservative estimate
        chunk_overlap=500,
        separators=["\n\n", "\n", ". ", " ", ""]
    )
    
    chunks = text_splitter.split_text(doc.page_content)
    print(Fore.YELLOW + f"Document split into {len(chunks)} chunks due to size" + Style.RESET_ALL)
    return chunks


def detect_repetition(text: str, threshold: int = 3) -> bool:
    """Detect if text contains excessive repetition"""
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    
    if not sentences:
        return False
    
    # Count similar sentences (first 50 chars as fingerprint)
    fingerprints = [s[:50].lower() for s in sentences]
    counts = Counter(fingerprints)
    
    # Check for any sentence appearing more than threshold times
    max_count = max(counts.values()) if counts else 0
    return max_count >= threshold


def clean_summary_output(text: str) -> str:
    """Post-process summary to remove artifacts and improve quality"""
    # Remove repetitive bullet points
    lines = text.split('\n')
    seen = set()
    cleaned_lines = []
    
    for line in lines:
        # Create a normalized version for comparison (remove minor variations)
        normalized = re.sub(r'\d+', '#', line.strip().lower()[:60])
        
        # Skip if we've seen this pattern more than once
        if normalized not in seen or len(normalized) < 10:
            cleaned_lines.append(line)
            seen.add(normalized)
    
    cleaned_text = '\n'.join(cleaned_lines)
    
    # Remove empty bullet points and excessive whitespace
    cleaned_text = re.sub(r'\n\s*[-*•]\s*\n', '\n', cleaned_text)
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
    
    return cleaned_text.strip()


def generate_doc_summary(model, tokenizer, content: str, chunk_num: int = None, title: str = "") -> str:
    """Generate summary for document content with improved prompt"""
    chunk_note = f" (Part {chunk_num})" if chunk_num else ""
    
    # Improved prompt with explicit instructions against repetition
    prompt = f"""You are summarizing a scientific research paper{chunk_note}: {title}

CRITICAL INSTRUCTIONS:
1. Extract ONLY key findings and quantitative results
2. Use exact numbers and terminology from the paper
3. Each point should be UNIQUE - never repeat similar information
4. Organize findings hierarchically by importance
5. Be comprehensive but concise - no redundancy
6. Focus on: methodology, results, conclusions
7. Ignore references, acknowledgments, and background

Text to summarize:
{content}

Summary:"""

    if tokenizer.chat_template is not None:
        messages = [{"role": "user", "content": prompt}]
        prompt = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True
        )

    response = generate(
        model, 
        tokenizer, 
        prompt=prompt, 
        verbose=False, 
        max_tokens=CONFIG["max_summary_tokens"]
    )
    
    # Post-process to remove artifacts
    response = clean_summary_output(response)
    
    # Check for repetition and warn
    if detect_repetition(response):
        print(Fore.RED + "⚠ Warning: Detected repetition in summary, applying additional cleaning..." + Style.RESET_ALL)
        response = clean_summary_output(response)
    
    return response


def combine_chunk_summaries(model, tokenizer, summaries: list[str], title: str = "") -> str:
    """Combine multiple chunk summaries into a coherent final summary"""
    combined = "\n\n".join([f"Section {i+1}:\n{s}" for i, s in enumerate(summaries)])
    
    prompt = f"""Synthesize these section summaries of the paper "{title}" into ONE coherent summary.

CRITICAL REQUIREMENTS:
1. Create a unified narrative - do NOT simply list sections
2. Remove ALL redundancy between sections
3. Organize by theme, not by section number
4. Preserve all unique quantitative findings
5. Each finding should appear EXACTLY ONCE
6. Maximum brevity while maintaining completeness

Section summaries:
{combined}

Unified summary:"""
    
    if tokenizer.chat_template is not None:
        messages = [{"role": "user", "content": prompt}]
        prompt = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True
        )

    response = generate(
        model, 
        tokenizer, 
        prompt=prompt, 
        verbose=False,
        max_tokens=CONFIG["max_summary_tokens"],
        temp=0.3,
        repetition_penalty=1.2
    )
    
    # Apply aggressive cleaning for combined summaries
    response = clean_summary_output(response)
    
    return response


def save_summary_as_pdf(summary: str, doc: Document, summaries_dir: str):
    """Save summary to PDF file in summaries directory"""
    # Create summaries directory if it doesn't exist
    Path(summaries_dir).mkdir(parents=True, exist_ok=True)
    
    # Generate filename from source
    source = doc.metadata.get("source", "unknown")
    filename = doc.metadata.get("filename", source)
    
    # Remove .pdf extension and create new filename
    base_name = os.path.splitext(filename)[0]
    summary_filename = f"summary_{base_name}.pdf"
    summary_path = os.path.join(summaries_dir, summary_filename)
    
    # Create PDF
    pdf_doc = SimpleDocTemplate(
        summary_path,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18,
    )
    
    # Define styles
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor='#1a1a1a',
        spaceAfter=30,
        alignment=TA_LEFT
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=11,
        alignment=TA_JUSTIFY,
        spaceAfter=12,
        leading=14
    )
    
    # Build PDF content
    story = []
    
    # Title
    story.append(Paragraph(f"Summary of: {source}", title_style))
    
    # Summary content - split into paragraphs
    paragraphs = summary.split('\n\n')
    for para in paragraphs:
        if para.strip():
            # Escape special characters for ReportLab
            para_clean = para.strip().replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(para_clean, body_style))
    
    # Build PDF
    pdf_doc.build(story)
    
    print(Fore.GREEN + f"✓ Summary PDF saved to: {summary_path}" + Style.RESET_ALL)
    
    # Also save metadata as JSON
    metadata_path = os.path.join(summaries_dir, f"summary_{base_name}_metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump({
            "source": source,
            "filename": filename,
            "num_pages": doc.metadata.get('num_pages'),
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S'),
            "summary_file": summary_filename,
            "model": CONFIG["model"]
        }, f, indent=2)


if __name__ == "__main__":
    init()  # Initialize colorama
    
    # Load model
    print(Fore.CYAN + "Loading model..." + Style.RESET_ALL)
    print(Fore.CYAN + f"Model: {CONFIG['model']}" + Style.RESET_ALL)
    model, tokenizer = load(CONFIG["model"])

    # Load documents
    docs = load_and_clean_pdfs(CONFIG["data_dir"])
    if not docs:
        print(Fore.RED + "No documents found!" + Style.RESET_ALL)
        exit()

    # Filter out already summarized documents
    docs_to_process = []
    skipped_count = 0
    
    for doc in docs:
        if is_already_summarized(doc, CONFIG["summaries_dir"]):
            print(Fore.BLUE + f"⊘ Skipping {doc.metadata['source']} (already summarized)" + Style.RESET_ALL)
            skipped_count += 1
        else:
            docs_to_process.append(doc)
    
    if not docs_to_process:
        print(Fore.GREEN + "\n✓ All documents have already been summarized!" + Style.RESET_ALL)
        exit()
    
    print(Fore.YELLOW + f"\nProcessing {len(docs_to_process)} new documents ({skipped_count} already summarized)" + Style.RESET_ALL)

    # Process each document
    for idx, doc in enumerate(docs_to_process):
        start = time.time()
        print(Fore.CYAN + f"\n{'='*80}" + Style.RESET_ALL)
        print(Fore.CYAN + f"Processing document {idx+1}/{len(docs_to_process)}: {doc.metadata['source']}" + Style.RESET_ALL)
        print(Fore.CYAN + f"{'='*80}" + Style.RESET_ALL)
        
        title = doc.metadata.get('source', '')
        
        # Check token count
        estimated_tokens = estimate_tokens(doc.page_content)
        print(Fore.YELLOW + f"Estimated tokens: {estimated_tokens:,}" + Style.RESET_ALL)
        
        if estimated_tokens > CONFIG["max_tokens"]:
            print(Fore.YELLOW + f"⚠ Document exceeds context window, using chunked summarization" + Style.RESET_ALL)
            
            # Chunk and summarize
            chunks = chunk_document(doc, max_chunk_tokens=CONFIG["max_tokens"] - 1000)
            chunk_summaries = []
            
            for i, chunk in enumerate(chunks, 1):
                print(Fore.YELLOW + f"Generating summary for chunk {i}/{len(chunks)}..." + Style.RESET_ALL)
                chunk_summary = generate_doc_summary(model, tokenizer, chunk, chunk_num=i, title=title)
                chunk_summaries.append(chunk_summary)
            
            # Combine summaries
            print(Fore.YELLOW + "Combining chunk summaries..." + Style.RESET_ALL)
            final_summary = combine_chunk_summaries(model, tokenizer, chunk_summaries, title=title)
        else:
            print(Fore.GREEN + "✓ Document fits in context window" + Style.RESET_ALL)
            print(Fore.YELLOW + "Generating summary..." + Style.RESET_ALL)
            final_summary = generate_doc_summary(model, tokenizer, doc.page_content, title=title)
        
        # Display and save summary
        print(Fore.RED + f"summarized ({time.time() - start:.2f} seconds)" + Style.RESET_ALL)
        print(Fore.CYAN + "\n" + "="*80 + Style.RESET_ALL)
        print(Fore.CYAN + "SUMMARY:" + Style.RESET_ALL)
        print(Fore.CYAN + "="*80 + Style.RESET_ALL)
        print(final_summary)
        print(Fore.CYAN + "="*80 + "\n" + Style.RESET_ALL)
        
        # Save to PDF
        save_summary_as_pdf(final_summary, doc, CONFIG["summaries_dir"])
    
    print(Fore.GREEN + f"\n✓ All summaries completed and saved to {CONFIG['summaries_dir']}" + Style.RESET_ALL)