# config.py
from pydantic_settings import BaseSettings
from typing import List, Tuple

class Settings(BaseSettings):
    documents_directory: str = "./data"
    csv_path: str = "./papers-2.csv"

    chunk_size: int = 1200
    chunk_overlap: int = 200
    splitter_separators: List[str] = ["\n\n", "\n", ".", "!", "?", ",", " ", ""]

    device: str = "cpu"

    # weights: (bm25, semantic)
    ensemble_weights: Tuple[float, float] = (0.3, 0.7)
    bm25_k: int = 20
    faiss_k: int = 10

    embedding_model: str = "all-minilm"
    rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    top_k: int = 7

    # hyde_model: str = "qwen2.5:0.5b"
    hyde_model: str = "llama3.2:1b"

    hyde_temp: float = 0.3
    hyde_topk: float = 40
    hyde_topp: float = 0.9
    num_pred: int = 100

    # answer_model: str = "gemma2:2b"
    answer_model: str = "llama3.2:3b"
    answer_temp: float = 0.1
    answer_topk: int = 20

# create settings
settings = Settings()