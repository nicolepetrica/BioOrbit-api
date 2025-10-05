from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_community.vectorstores import FAISS
from langchain.schema import Document
from rag.settings import settings
import pandas as pd
import ollama
import fitz  # PyMuPDF
import re
import os
import json
import numpy as np

class OllamaEmbeddings:
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors = []
        for t in texts:
            resp = ollama.embed(model=settings.embedding_model, input=t)
            vectors.append(resp['embeddings'][0])
        return vectors

    def embed_query(self, text: str) -> list[float]:
        resp = ollama.embed(model=settings.embedding_model, input=text)
        return resp['embeddings'][0]

    def __call__(self, text: str) -> list[float]:
        return self.embed_query(text)

class RAG:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _clean_pdf_text(self, text: str) -> str:
        """
        Cleans PDF text:
        - Remove headers/footers (simple heuristic: lines repeated many times)
        - Dehyphenate words split across lines
        - Normalize whitespace
        """
        # Normalize newlines and whitespace
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        text = re.sub(r'\n{2,}', '\n', text)  # collapse multiple blank lines

        # Remove hyphenation at line breaks: "exam-\nple" -> "example"
        text = re.sub(r'-\n', '', text)

        # Remove remaining line breaks inside paragraphs
        text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)

        # Normalize multiple spaces
        text = re.sub(r'\s+', ' ', text)

        # Optional: remove repeated headers/footers (simple heuristic)
        lines = text.split('\n')
        lines_seen = set()
        cleaned_lines = []
        for line in lines:
            line_strip = line.strip()
            if line_strip and line_strip not in lines_seen:
                cleaned_lines.append(line_strip)
                lines_seen.add(line_strip)
        text = ' '.join(cleaned_lines)

        return text

    def _load_and_clean_pdfs(self) -> list[Document]:
        """
        Loads PDFs, cleans text, splits into chunks, and returns LangChain Documents with rich metadata
        """
        directory = settings.documents_directory
        all_documents = []

        for filename in os.listdir(directory):
            if not filename.lower().endswith(".pdf"):
                continue

            base_name = os.path.splitext(filename)[0]  # removes ".pdf"

            filepath = os.path.join(directory, filename)
            pdf = fitz.open(filepath)

            total_pages = pdf.page_count
            full_text = ""

            # Extract all pages
            for page_number, page in enumerate(pdf, start=1):
                page_text = page.get_text()
                full_text += page_text + "\n"
            pdf.close()

            cleaned_text = self._clean_pdf_text(full_text)

            # Split into chunks
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=settings.chunk_size,          # maximum tokens/characters per chunk
                chunk_overlap=settings.chunk_overlap,    # overlap between chunks
                separators=settings.splitter_separators  # try larger separators first
            )
            chunks = splitter.split_text(cleaned_text)

            # Convert chunks into Documents with metadata
            for i, chunk in enumerate(chunks):
                doc = Document(
                    page_content=chunk,
                    metadata={
                        "title": base_name,
                        "source": base_name,           # full filename for display
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                        "total_pages": total_pages
                    }
                )
                all_documents.append(doc)

        return all_documents
    
    def __init__(self):
        
        self.embeddings = OllamaEmbeddings()
        self.docs = self._load_and_clean_pdfs()

        # Create FAISS retriever
        # Cache the FAISS index to disk
        index_path = "faiss_index"
        if os.path.exists(index_path):
            vectorstore = FAISS.load_local(
                index_path, 
                self.embeddings,
                allow_dangerous_deserialization=True
            )
        else:
            vectorstore = FAISS.from_documents(self.docs, self.embeddings)
            vectorstore.save_local(index_path)
            
        faiss_retriever = vectorstore.as_retriever(search_kwargs={"k": settings.faiss_k})
        
        # Create BM25 retriever
        bm25_retriever = BM25Retriever.from_documents(self.docs)
        bm25_retriever.k = settings.bm25_k
        
        # in __init__ after creation:
        self.faiss_vectorstore = vectorstore
        self.faiss_retriever = faiss_retriever
        self.bm25_retriever = bm25_retriever

        # Create ensemble retriever combining both
        self.retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, faiss_retriever],
            weights=settings.ensemble_weights  # Equal weights; adjust based on your needs
        )

        if os.path.exists(settings.csv_path):
            self.publications_df = pd.read_csv(settings.csv_path)
        else: 
            print(f"Warning: CSV file {settings.csv_path} not found. Publication metadata will be unavailable.")
            self.publications_df = pd.DataFrame()
        self.publications_df['Title'] = self.publications_df['Title'].str.strip()

    def _generate_hyde_prompt(self, prompt: str) -> str:
        response = ollama.generate(
            model=settings.hyde_model,
            prompt=f"""Generate a short, concise paragraph that reads like part of a factual article or encyclopedia entry. It should be 2-3 sentences maximum.

Question: {prompt}

Answer:""",
            stream=False,
            options={
                'temperature': settings.hyde_temp,
                'top_k': settings.hyde_topk,
                'top_p': settings.hyde_topp,
                'num_predict': settings.num_pred
            }
        )

        return response['response']
    
    def _manual_ensemble(self, query: str, hyde: str, w_faiss=0.5, w_bm25=0.5, k=10):
        faiss_results = self.faiss_vectorstore.similarity_search_with_score(hyde, k=k)
        faiss_docs = [(doc, 1.0/(1.0+abs(score))) for doc, score in faiss_results]
        bm25_docs = self.bm25_retriever.get_relevant_documents(query)[:k]
        bm25_ranked = [(doc, 1.0/(i+1)) for i, doc in enumerate(bm25_docs)]
        merged = {}
        for doc, s in faiss_docs:
            key = (doc.metadata.get("source"), doc.metadata.get("chunk_index"))
            merged.setdefault(key, {"doc": doc, "faiss":0.0, "bm25":0.0})["faiss"] = s
        for doc, s in bm25_ranked:
            key = (doc.metadata.get("source"), doc.metadata.get("chunk_index"))
            merged.setdefault(key, {"doc": doc, "faiss":0.0, "bm25":0.0})["bm25"] = s
        combined = [(v["doc"], w_faiss*v["faiss"] + w_bm25*v["bm25"]) for v in merged.values()]
        combined.sort(key=lambda x: x[1], reverse=True)
        return [d for d,_ in combined[:k]]


    def _retrieve_documents(self, prompt: str, hyde: str):
        """
        Retrieve relevant documents from the vectorstore for a given prompt.
        Returns a list of LangChain Document objects.
        """
        if not hasattr(self, "retriever"):
            raise ValueError("Retriever is not initialized. Make sure __init__ has been called.")

        # Use the retriever to get top-k documents
        # docs = self.retriever.invoke(prompt)
        weights = getattr(settings, "ensemble_weights", (0.3, 0.7))
        docs = self._manual_ensemble(prompt, hyde, weights[0], weights[1], settings.bm25_k)
        return docs

    def _rerank_documents(self, query: str, documents: list[Document]) -> list[Document]:
        if not documents:
            return []
        query_vec = np.array(self.embeddings.embed_query(query))
        doc_scores = []
        for doc in documents:
            doc_vec = np.array(self.embeddings.embed_query(doc.page_content))
            sim = np.dot(query_vec, doc_vec) / (np.linalg.norm(query_vec)*np.linalg.norm(doc_vec)+1e-10)
            doc_scores.append((doc, sim))
        doc_scores.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc,_ in doc_scores[:settings.top_k]]

    def _generate_context_from_documents(self, documents: list[Document]) -> tuple[str, dict]:
        context = ""

        # Create a mapping from document ID to document title/filename
        doc_id_to_title = {}
        
        print("\n" + "="*60)
        print("DEBUG: Building context from documents")
        print("="*60)
        
        for i, doc in enumerate(documents):
            # Assuming the IDs in source_ids will be in format 'doc0', 'doc1', etc.
            doc_id = f"doc{i}"

            # Try to get source, fall back to file_id if source is missing
            title = doc.metadata.get('title', doc.metadata.get('file_id', 'Unknown'))
            file_id = doc.metadata.get('file_id', title)
            content = doc.page_content
            
            print(f"Document {i}:")
            print(f"  - doc_id: {doc_id}")
            print(f"  - title from metadata: {title}")
            print(f"  - file_id from metadata: {file_id}")
            print(f"  - full metadata: {doc.metadata}")
            print(f"  - content preview: {content[:100]}...")
            print()
            
            context += f"[id: {doc_id} | title: {title}]\n{content}\n\n"
            
            # Store the actual filename (source) not file_id
            doc_id_to_title[doc_id] = title
        
        print(f"Final doc_id_to_title mapping: {doc_id_to_title}")
        print("="*60 + "\n")
        
        return context, doc_id_to_title

    def _generate_context_based_answer(self, documents: list[Document], prompt: str, stream: bool=False) -> tuple[str, list[str]]:
        context, doc_id_to_title = self._generate_context_from_documents(documents)

        schema = {
            "type": "object",
            "properties": {
                "answer": {
                    "type": "string",
                    "description": "The answer to the user's question based on the provided context"
                },
                "source_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of document IDs used to generate the answer (e.g., ['doc0', 'doc4'])"
                }
            },
            "required": ["answer", "source_ids"]
        }

        full_prompt = f"""Using ONLY the following context, answer the user's question.
You MUST include the document IDs you used in the 'source_ids' field of your JSON response.

Context: 
{context}

Question: {prompt}

Provide your answer in JSON format with 'answer' and 'source_ids' fields."""
        
        print(f"PROMPT: \n {full_prompt}")

        response = ollama.generate(
            model=settings.answer_model,
            prompt=full_prompt,
            stream=stream,
            format=schema,
            options={
                'temperature': settings.answer_temp,
                'top_k': settings.answer_topk,
            }
        )

        # FIX: Access response correctly
        raw_text = response['response'].strip()
        
        print("\n" + "="*60)
        print("DEBUG: LLM Response Analysis")
        print("="*60)
        print(f"Raw response text:\n{raw_text}")
        print("="*60 + "\n")

        try:
            response_dict = json.loads(raw_text)
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parsing failed: {e}")
            print("⚠️ Model returned non-JSON. Raw output:")
            print(raw_text)
            # fallback
            response_dict = {"answer": raw_text, "source_ids": []}

        answer = response_dict.get("answer", "")
        ids = response_dict.get("source_ids", [])
        
        print("\n" + "="*60)
        print("DEBUG: Source ID Matching")
        print("="*60)
        print(f"doc_id_to_title mapping: {doc_id_to_title}")
        print(f"Returned source_ids from LLM: {ids}")
        print(f"Type of source_ids: {type(ids)}")
        if ids:
            print(f"Type of first ID: {type(ids[0])}")
        print("="*60 + "\n")

        # Get titles for each source ID
        source_titles = []
        for source_id in ids:
            source_id_cleaned = str(source_id).strip()  # Ensure string and remove whitespace
            print(f"Processing ID: '{source_id}' -> cleaned: '{source_id_cleaned}'")
            
            if source_id_cleaned in doc_id_to_title:
                matched_title = doc_id_to_title[source_id_cleaned]
                print(f"  ✓ Matched to: {matched_title}")
                source_titles.append(matched_title)
            else:
                print(f"  ✗ NOT FOUND in mapping!")
                print(f"  Available keys: {list(doc_id_to_title.keys())}")
                source_titles.append(f"Unknown document ({source_id_cleaned})")

        print(f"\nFinal Answer: {answer}")
        print(f"Final Source PDFs: {source_titles}\n")
        
        # Return both the answer and the source titles
        return answer, source_titles
    
    def _get_publication_metadata(self, title: str) -> dict:
        """
        Retrieve publication metadata from CSV based on title.
        Returns dict with relevant fields or None if not found.
        """
        # Try exact match first
        match = self.publications_df[self.publications_df['Title'] == title]
        
        # If no exact match, try case-insensitive match
        if match.empty:
            match = self.publications_df[
                self.publications_df['Title'].str.lower() == title.lower()
            ]
        
        # If still no match, try partial match (contains)
        if match.empty:
            match = self.publications_df[
                self.publications_df['Title'].str.contains(title, case=False, na=False)
            ]
        
        if not match.empty:
            # Get the first match
            row = match.iloc[0]
            
            # Extract relevant fields, handling potential NaN values
            metadata = {
                'title': row.get('Title', 'N/A'),
                'link': row.get('Link', 'N/A'),
                'journal': row.get('Journal Title', 'N/A'),
                'year': row.get('Publication Year', 'N/A'),
                'authors': row.get('Authors', 'N/A'),
                'keywords': row.get('Keywords', 'N/A'),
                'tldr': row.get('TLDR Summary', 'N/A'),
                'doi': row.get('DOI', 'N/A'),
            }
            
            # Replace NaN with 'N/A'
            for key, value in metadata.items():
                if pd.isna(value):
                    metadata[key] = 'N/A'
            
            return metadata
        
        return None

    def prompt(self, prompt: str) -> tuple[str, list[str]]:
        hyde_prompt = self._generate_hyde_prompt(prompt)
        # print(f"HYDE PROMPT: {hyde_prompt}")

        relevant_docs = self._retrieve_documents(prompt, hyde_prompt)

        # Rerank with the original user prompt (not hyde_prompt)
        reranked_docs = self._rerank_documents(prompt, relevant_docs)
        
        # print(f"\n{'='*50}")
        # print(f"RERANKED DOCUMENTS (Top {len(reranked_docs)})")
        # print(f"{'='*50}\n")
        
        # for d in reranked_docs:
        #     print(14*"=")
        #     print(f"SOURCE: {d.metadata['source']}")
        #     print(d.page_content)

        answer, source_titles = self._generate_context_based_answer(reranked_docs, prompt)

        enriched = []
        for title in source_titles:
            enriched.append(self._get_publication_metadata(title))

        return {
            "answer": answer,
            "source": enriched
        }
    
    # In rag.py, change back to:
    # def prompt_stream(self, prompt: str):  # Remove async
    #     hyde_prompt = self._generate_hyde_prompt(prompt)
    #     relevant_docs = self._retrieve_documents(hyde_prompt)
    #     reranked_docs = self._rerank_documents(prompt, relevant_docs)
        
    #     response_generator = self._generate_context_based_answer(reranked_docs, prompt, stream=True)
        
    #     for chunk in response_generator:
    #         yield chunk 