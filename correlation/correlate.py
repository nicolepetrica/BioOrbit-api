# correlation_builder.py
from mlx_lm import load, generate
import fitz  # PyMuPDF
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json
import os
import time
from pathlib import Path
from colorama import Fore, Style, init
import re
from datetime import datetime

# -----------------------
# Configuration
# -----------------------
CONFIG = {
    "summaries_dir": "./summaries",
    "correlations_dir": "./correlations", 
    "model": "mlx-community/Qwen2.5-3B-Instruct-4bit",
    "max_tokens": 32000,
    "max_correlation_tokens": 4096,
    "min_cluster_size": 3,
    "max_clusters": 20,
}

# -----------------------
# Simple Embedding Generator (TF-IDF based)
# -----------------------
class SimpleEmbedder:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=512,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.8
        )
        self.is_fitted = False
    
    def fit_transform(self, texts):
        """Fit TF-IDF and transform texts to vectors"""
        tfidf_matrix = self.vectorizer.fit_transform(texts).toarray()
        self.is_fitted = True
        return tfidf_matrix
    
    def transform(self, texts):
        """Transform new texts using fitted TF-IDF"""
        if not self.is_fitted:
            raise ValueError("Embedder must be fitted first")
        return self.vectorizer.transform(texts).toarray()

# -----------------------
# Correlation Builder
# -----------------------
class CorrelationBuilder:
    def __init__(self, config):
        self.config = config
        self.embedder = SimpleEmbedder()
        self.summaries_data = []
        self.model, self.tokenizer = None, None
        
    def load_model(self):
        """Load the main MLX model for correlation generation"""
        print(Fore.CYAN + "Loading correlation model..." + Style.RESET_ALL)
        print(Fore.CYAN + f"Model: {self.config['model']}" + Style.RESET_ALL)
        self.model, self.tokenizer = load(self.config["model"])
        
    def extract_summary_text(self, pdf_path):
        """Extract text from summary PDF"""
        try:
            doc = fitz.open(pdf_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            print(Fore.RED + f"Error reading {pdf_path}: {e}" + Style.RESET_ALL)
            return None
    
    def clean_text_for_embedding(self, text):
        """Clean text for better embedding generation"""
        # Remove common summary artifacts
        cleaned = re.sub(r'Summary of:.*?\n', '', text)
        cleaned = re.sub(r'[^\w\s.,;:!?()-]', ' ', cleaned)  # Keep basic punctuation
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()
    
    def load_summaries(self):
        """Load all summary PDFs from the summaries directory"""
        print(Fore.YELLOW + "Loading existing summaries..." + Style.RESET_ALL)
        
        if not os.path.exists(self.config["summaries_dir"]):
            print(Fore.RED + f"Summaries directory {self.config['summaries_dir']} not found!" + Style.RESET_ALL)
            return False
            
        summary_files = [f for f in os.listdir(self.config["summaries_dir"]) 
                        if f.startswith("summary_") and f.endswith(".pdf")]
        
        if not summary_files:
            print(Fore.RED + "No summary files found! Run summarization first." + Style.RESET_ALL)
            return False
        
        for filename in summary_files:
            file_path = os.path.join(self.config["summaries_dir"], filename)
            summary_text = self.extract_summary_text(file_path)
            
            if summary_text and len(summary_text) > 100:  # Ensure meaningful content
                # Extract original paper name from summary filename
                original_paper = filename.replace("summary_", "").replace(".pdf", "") + ".pdf"
                cleaned_text = self.clean_text_for_embedding(summary_text)
                
                self.summaries_data.append({
                    'summary_file': filename,
                    'original_paper': original_paper,
                    'summary_text': summary_text,
                    'cleaned_text': cleaned_text,
                    'embedding': None
                })
        
        print(Fore.GREEN + f"✓ Loaded {len(self.summaries_data)} summaries" + Style.RESET_ALL)
        return True
    
    def create_embeddings(self):
        """Create TF-IDF embeddings for all summaries"""
        print(Fore.YELLOW + "Creating TF-IDF embeddings..." + Style.RESET_ALL)
        
        if len(self.summaries_data) < 2:
            print(Fore.RED + "Need at least 2 summaries to create embeddings!" + Style.RESET_ALL)
            return False
        
        texts = [item['cleaned_text'] for item in self.summaries_data]
        
        try:
            # Create TF-IDF embeddings
            embeddings = self.embedder.fit_transform(texts)
            
            # Store embeddings
            for i, embedding in enumerate(embeddings):
                self.summaries_data[i]['embedding'] = embedding
                
            print(Fore.GREEN + f"✓ Created {embeddings.shape[1]}-dimensional embeddings for {len(embeddings)} summaries" + Style.RESET_ALL)
            return True
            
        except Exception as e:
            print(Fore.RED + f"Error creating embeddings: {e}" + Style.RESET_ALL)
            # Fallback: use random embeddings (better than nothing)
            print(Fore.YELLOW + "Using fallback embedding method..." + Style.RESET_ALL)
            for i in range(len(self.summaries_data)):
                self.summaries_data[i]['embedding'] = np.random.randn(100)
            return True
    
    def determine_optimal_clusters(self, embeddings):
        """Determine optimal number of clusters using simple heuristic"""
        n_samples = len(embeddings)
        
        if n_samples <= 5:
            return max(2, n_samples - 1)
        
        # Simple heuristic based on sample size
        if n_samples < 10:
            return 3
        elif n_samples < 30:
            return min(5, n_samples // 3)
        elif n_samples < 100:
            return min(8, n_samples // 5)
        else:
            return min(self.config["max_clusters"], n_samples // 10)
    
    def cluster_summaries(self):
        """Cluster summaries by topic similarity"""
        if len(self.summaries_data) < 3:
            print(Fore.RED + "Need at least 3 summaries to cluster!" + Style.RESET_ALL)
            return None
        
        embeddings = np.array([item['embedding'] for item in self.summaries_data])
        
        # Determine optimal number of clusters
        n_clusters = self.determine_optimal_clusters(embeddings)
        print(Fore.YELLOW + f"Using {n_clusters} clusters for {len(embeddings)} papers" + Style.RESET_ALL)
        
        try:
            # Perform clustering
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(embeddings)
            
            # Add cluster labels to data
            for i, cluster_id in enumerate(cluster_labels):
                self.summaries_data[i]['cluster'] = int(cluster_id)
            
            # Print cluster sizes
            cluster_counts = {}
            for item in self.summaries_data:
                cluster_id = item['cluster']
                cluster_counts[cluster_id] = cluster_counts.get(cluster_id, 0) + 1
            
            print(Fore.GREEN + "Cluster distribution:" + Style.RESET_ALL)
            for cluster_id, count in sorted(cluster_counts.items()):
                print(Fore.CYAN + f"  Cluster {cluster_id}: {count} papers" + Style.RESET_ALL)
            
            return cluster_labels
            
        except Exception as e:
            print(Fore.RED + f"Clustering failed: {e}" + Style.RESET_ALL)
            print(Fore.YELLOW + "Using sequential clustering as fallback..." + Style.RESET_ALL)
            # Simple fallback: assign clusters sequentially
            for i, item in enumerate(self.summaries_data):
                item['cluster'] = i % min(5, len(self.summaries_data))
            return [item['cluster'] for item in self.summaries_data]
    
    def generate_correlation_prompt(self, cluster_papers):
        """Generate prompt for correlation analysis"""
        context = "CORRELATE THESE RELATED RESEARCH PAPERS:\n\n"
        
        for i, paper in enumerate(cluster_papers, 1):
            # Truncate very long summaries but keep key information
            summary_preview = paper['summary_text'][:1200] + "..." if len(paper['summary_text']) > 1200 else paper['summary_text']
            
            context += f"PAPER {i}: {paper['original_paper']}\n"
            context += f"SUMMARY: {summary_preview}\n"
            context += "─" * 60 + "\n"
        
        prompt = f"""Analyze these {len(cluster_papers)} related research papers and create a comprehensive correlation document.

CRITICAL REQUIREMENTS:
1. Identify COMMON themes, methodologies, and findings across all papers
2. Highlight CONTRADICTIONS or differing results between papers
3. Show how the research EVOLVES or connects across the papers
4. Synthesize unified conclusions about this research area
5. Identify important GAPS in the current research
6. Suggest promising future research directions

STRUCTURE YOUR ANALYSIS AS:
# Research Area Overview
[Brief description of the common research theme]

# Common Methodologies and Approaches  
[What methods do these papers share?]

# Key Converging Findings
[What findings are consistent across multiple papers?]

# Points of Contention and Differences
[Where do the papers disagree or show different results?]

# Research Gaps and Limitations
[What's missing or limited in the current research?]

# Future Research Directions
[What should be studied next based on these papers?]

# Practical Implications and Applications
[How can this research be applied?]

Papers to correlate:
{context}

Comprehensive Correlation Analysis:"""
        
        return prompt
    
    def generate_correlation_analysis(self, prompt):
        """Generate correlation analysis using MLX model"""
        try:
            if self.tokenizer.chat_template is not None:
                messages = [{"role": "user", "content": prompt}]
                prompt = self.tokenizer.apply_chat_template(
                    messages, add_generation_prompt=True
                )

            response = generate(
                self.model, 
                self.tokenizer, 
                prompt=prompt, 
                verbose=False, 
                max_tokens=self.config["max_correlation_tokens"],
            )
            
            return response.strip()
            
        except Exception as e:
            print(Fore.RED + f"Error generating correlation: {e}" + Style.RESET_ALL)
            return f"Error generating correlation analysis: {str(e)}"
    
    def save_correlation_document(self, cluster_id, papers, correlation_text):
        """Save correlation document to file"""
        os.makedirs(self.config["correlations_dir"], exist_ok=True)
        
        correlation_data = {
            'cluster_id': cluster_id,
            'paper_count': len(papers),
            'papers': [{
                'original_paper': paper['original_paper'],
                'summary_file': paper['summary_file']
            } for paper in papers],
            'correlation_content': correlation_text,
            'generated_at': datetime.now().isoformat(),
            'model_used': self.config["model"]
        }
        
        # Save as JSON
        json_filename = f"correlation_cluster_{cluster_id}_{len(papers)}_papers.json"
        json_path = os.path.join(self.config["correlations_dir"], json_filename)
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(correlation_data, f, indent=2, ensure_ascii=False)
        
        # Save as readable text
        txt_filename = f"correlation_cluster_{cluster_id}_{len(papers)}_papers.txt"
        txt_path = os.path.join(self.config["correlations_dir"], txt_filename)
        
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(f"CORRELATION DOCUMENT - Cluster {cluster_id}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Papers: {len(papers)}\n")
            f.write("=" * 80 + "\n\n")
            f.write(correlation_text)
            f.write("\n\n" + "=" * 80 + "\n")
            f.write("INCLUDED PAPERS:\n")
            for i, paper in enumerate(papers, 1):
                f.write(f"{i}. {paper['original_paper']}\n")
        
        return json_path, txt_path
    
    def generate_all_correlations(self):
        """Generate correlation documents for all clusters"""
        print(Fore.CYAN + "\n" + "=" * 80 + Style.RESET_ALL)
        print(Fore.CYAN + "GENERATING CORRELATION DOCUMENTS" + Style.RESET_ALL)
        print(Fore.CYAN + "=" * 80 + Style.RESET_ALL)
        
        # Group papers by cluster
        clusters = {}
        for paper in self.summaries_data:
            cluster_id = paper['cluster']
            if cluster_id not in clusters:
                clusters[cluster_id] = []
            clusters[cluster_id].append(paper)
        
        correlation_results = []
        
        for cluster_id, papers in clusters.items():
            if len(papers) < self.config["min_cluster_size"]:
                print(Fore.BLUE + f"⊘ Skipping cluster {cluster_id} (only {len(papers)} papers, need {self.config['min_cluster_size']})" + Style.RESET_ALL)
                continue
            
            print(Fore.YELLOW + f"\nProcessing cluster {cluster_id} ({len(papers)} papers)..." + Style.RESET_ALL)
            
            start_time = time.time()
            
            try:
                # Generate correlation prompt
                prompt = self.generate_correlation_prompt(papers)
                
                # Generate correlation analysis
                print(Fore.CYAN + "Generating correlation analysis..." + Style.RESET_ALL)
                correlation_text = self.generate_correlation_analysis(prompt)
                
                # Save results
                json_path, txt_path = self.save_correlation_document(cluster_id, papers, correlation_text)
                
                elapsed = time.time() - start_time
                
                print(Fore.GREEN + f"✓ Generated correlation for cluster {cluster_id}" + Style.RESET_ALL)
                print(Fore.CYAN + f"  Files: {os.path.basename(json_path)}, {os.path.basename(txt_path)}" + Style.RESET_ALL)
                print(Fore.CYAN + f"  Time: {elapsed:.2f} seconds" + Style.RESET_ALL)
                
                # Show preview of correlation
                preview = correlation_text[:200] + "..." if len(correlation_text) > 200 else correlation_text
                print(Fore.CYAN + f"  Preview: {preview}" + Style.RESET_ALL)
                
                correlation_results.append({
                    'cluster_id': cluster_id,
                    'paper_count': len(papers),
                    'json_path': json_path,
                    'txt_path': txt_path,
                    'processing_time': elapsed
                })
                
            except Exception as e:
                print(Fore.RED + f"✗ Error processing cluster {cluster_id}: {e}" + Style.RESET_ALL)
                continue
        
        return correlation_results
    
    def run_complete_pipeline(self):
        """Run the complete correlation pipeline"""
        print(Fore.CYAN + "🚀 STARTING CORRELATION DOCUMENT GENERATION" + Style.RESET_ALL)
        start_time = time.time()
        
        # Load model
        self.load_model()
        
        # Load summaries
        if not self.load_summaries():
            return None
        
        # Create embeddings
        if not self.create_embeddings():
            return None
        
        # Cluster summaries
        clusters = self.cluster_summaries()
        if clusters is None:
            return None
        
        # Generate correlations
        results = self.generate_all_correlations()
        
        total_time = time.time() - start_time
        
        # Print summary
        print(Fore.CYAN + "\n" + "=" * 80 + Style.RESET_ALL)
        print(Fore.CYAN + "CORRELATION GENERATION COMPLETE" + Style.RESET_ALL)
        print(Fore.CYAN + "=" * 80 + Style.RESET_ALL)
        
        if results:
            total_papers = sum(result['paper_count'] for result in results)
            total_processing_time = sum(result['processing_time'] for result in results)
            
            print(Fore.GREEN + f"✓ Generated {len(results)} correlation documents" + Style.RESET_ALL)
            print(Fore.GREEN + f"✓ Covered {total_papers} total papers" + Style.RESET_ALL)
            print(Fore.GREEN + f"✓ Total processing time: {total_time:.2f} seconds" + Style.RESET_ALL)
            print(Fore.GREEN + f"✓ Output directory: {self.config['correlations_dir']}" + Style.RESET_ALL)
        else:
            print(Fore.YELLOW + "No correlation documents were generated." + Style.RESET_ALL)
            print(Fore.YELLOW + "This might be because:" + Style.RESET_ALL)
            print(Fore.YELLOW + "  - Clusters were too small (min cluster size: {self.config['min_cluster_size']})" + Style.RESET_ALL)
            print(Fore.YELLOW + "  - Not enough summaries were loaded" + Style.RESET_ALL)
        
        return results

# -----------------------
# Main Execution
# -----------------------
if __name__ == "__main__":
    init()  # Initialize colorama
    
    # Create and run correlation builder
    builder = CorrelationBuilder(CONFIG)
    results = builder.run_complete_pipeline()
    
    if results:
        print(Fore.GREEN + "\n🎉 Correlation documents ready for your RAG system!" + Style.RESET_ALL)
        print(Fore.YELLOW + "\nNext steps:" + Style.RESET_ALL)
        print(Fore.CYAN + "1. Use the generated JSON files in your RAG system" + Style.RESET_ALL)
        print(Fore.CYAN + "2. The correlations are in: ./correlations/" + Style.RESET_ALL)
        print(Fore.CYAN + "3. Implement two-stage retrieval (correlations first, then individual papers)" + Style.RESET_ALL)
    else:
        print(Fore.RED + "\n❌ Correlation generation failed or no correlations were created." + Style.RESET_ALL)
        print(Fore.YELLOW + "Make sure you have summary PDFs in ./summaries/ directory" + Style.RESET_ALL)