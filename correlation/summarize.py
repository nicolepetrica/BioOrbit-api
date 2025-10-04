from mlx_lm import load, generate
import fitz  # PyMuPDF
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from colorama import Fore, Style, init
from sentence_transformers import CrossEncoder
import re
import os
import time
from pathlib import Path
import json

# -----------------------
# Configuration
# -----------------------
CONFIG = {
    "data_dir": "./data",
    "summaries_dir": "./summaries",
    "model": "mlx-community/Qwen2.5-3B-Instruct-4bit", 
    "max_tokens": 32000,
}


# -----------------------
# Helper Functions
# -----------------------
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


def generate_doc_summary(model, tokenizer, content: str, chunk_num: int = None) -> str:
    """Generate summary for document content"""
    chunk_note = f" (Part {chunk_num})" if chunk_num else ""
    prompt = f"""You are analyzing a NASA-funded bioscience research publication{chunk_note}.

TASK: Extract results and key findings with scientific precision.

CRITICAL RULES:
1. Report ONLY information explicitly stated in the text
2. Use exact numerical values as written (never approximate or round)
3. Clearly distinguish between experimental conditions
4. Never repeat the same finding in different words
5. If uncertain about any detail, omit it completely

FOCUS ON:
- Quantitative results (measurements, percentages, statistical significance)
- Experimental comparisons
- Author conclusions
- Key findings

AVOID:
- Repetitive statements about the same result
- Background information or methods
- Speculation not present in the text

Text:
{content}
"""

    if tokenizer.chat_template is not None:
        messages = [{"role": "user", "content": prompt}]
        prompt = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True
        )

    response = generate(model, tokenizer, prompt=prompt, verbose=False, max_tokens=2048)
    return response


def combine_chunk_summaries(model, tokenizer, summaries: list[str]) -> str:
    """Combine multiple chunk summaries into a coherent final summary"""
    combined = "\n\n".join([f"Part {i+1}:\n{s}" for i, s in enumerate(summaries)])
    
    prompt = f"""Below are summaries of different sections of a NASA bioscience publication. Create a unified, coherent summary that captures all key findings and results:

{combined}
"""
    if tokenizer.chat_template is not None:
        messages = [{"role": "user", "content": prompt}]
        prompt = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True
        )

    response = generate(model, tokenizer, prompt=prompt, verbose=False)
    return response


def save_summary(summary: str, doc: Document, summaries_dir: str):
    """Save summary to file in summaries directory"""
    # Create summaries directory if it doesn't exist
    Path(summaries_dir).mkdir(parents=True, exist_ok=True)
    
    # Generate filename from source
    source = doc.metadata.get("source", "unknown")
    filename = doc.metadata.get("filename", source)
    
    # Remove .pdf extension and add .txt
    base_name = os.path.splitext(filename)[0]
    summary_filename = f"{base_name}_summary.txt"
    summary_path = os.path.join(summaries_dir, summary_filename)
    
    # Save summary with metadata
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write(f"Summary of: {source}\n")
        f.write(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Pages: {doc.metadata.get('num_pages', 'unknown')}\n")
        f.write("=" * 80 + "\n\n")
        f.write(summary)
    
    print(Fore.GREEN + f"✓ Summary saved to: {summary_path}" + Style.RESET_ALL)
    
    # Also save metadata as JSON
    metadata_path = os.path.join(summaries_dir, f"{base_name}_metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump({
            "source": source,
            "filename": filename,
            "num_pages": doc.metadata.get('num_pages'),
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S'),
            "summary_file": summary_filename
        }, f, indent=2)


if __name__ == "__main__":
    init()  # Initialize colorama
    
    # Load model
    print(Fore.CYAN + "Loading model..." + Style.RESET_ALL)
    model, tokenizer = load(CONFIG["model"])

    # Load documents
    docs = load_and_clean_pdfs(CONFIG["data_dir"])
    if not docs:
        print(Fore.RED + "No documents found!" + Style.RESET_ALL)
        exit()

    # Process each document
    for idx, doc in enumerate(docs):
        start = time.time()
        print(Fore.CYAN + f"\n{'='*80}" + Style.RESET_ALL)
        print(Fore.CYAN + f"Processing document {idx+1}/{len(docs)}: {doc.metadata['source']}" + Style.RESET_ALL)
        print(Fore.CYAN + f"{'='*80}" + Style.RESET_ALL)
        
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
                chunk_summary = generate_doc_summary(model, tokenizer, chunk, chunk_num=i)
                chunk_summaries.append(chunk_summary)
            
            # Combine summaries
            print(Fore.YELLOW + "Combining chunk summaries..." + Style.RESET_ALL)
            final_summary = combine_chunk_summaries(model, tokenizer, chunk_summaries)
        else:
            print(Fore.GREEN + "✓ Document fits in context window" + Style.RESET_ALL)
            print(Fore.YELLOW + "Generating summary..." + Style.RESET_ALL)
            final_summary = generate_doc_summary(model, tokenizer, doc.page_content)
        
        # Display and save summary
        print(Fore.RED + f"summarized ({time.time() - start:.2f} seconds)" + Style.RESET_ALL)
        print(Fore.CYAN + "\n" + "="*80 + Style.RESET_ALL)
        print(Fore.CYAN + "SUMMARY:" + Style.RESET_ALL)
        print(Fore.CYAN + "="*80 + Style.RESET_ALL)
        print(final_summary)
        print(Fore.CYAN + "="*80 + "\n" + Style.RESET_ALL)
        
        # Save to file
        save_summary(final_summary, doc, CONFIG["summaries_dir"])
    
    print(Fore.GREEN + f"\n✓ All summaries completed and saved to {CONFIG['summaries_dir']}" + Style.RESET_ALL)