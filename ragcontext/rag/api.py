from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag.rag import RAG
import uvicorn
import logging
import time
import ollama

# Logging Settings
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_api")

app = FastAPI(title="RAG API", description="Retrieval-Augmented Generation API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schema
class Query(BaseModel):
    question: str

def wait_for_ollama_models(interval=5):
    """
    Wait until all REQUIRED_MODELS are available in Ollama.
    - timeout: max seconds to wait
    - interval: seconds between checks
    """
    logger.info("🟡 Waiting for Ollama models to become available...")
    
    while True:
        try:
            response = ollama.list()
            available = [m["model"] for m in response["models"]]
            if len(available) >= 4:
                break

            logger.info(f"Models missing: {available}. Retrying in {interval}s...")
        except Exception as e:
            logger.warning(f"Ollama not responding yet: {e}. Retrying in {interval}s...")

        time.sleep(interval)


# Initialize RAG
#try:
time.sleep(10)
logger.info("Waiting for Ollama to be ready...")
wait_for_ollama_models(20)

logger.info("Initializing RAG pipeline...")
rag = RAG()
logger.info("RAG initialized successfully.")
#except Exception as e:
    #logger.error(f"Error initializing RAG: {e}")
    #rag = None

# Health Check
@app.get("/")
def root():
    return {"message": "RAG API is running..."}


@app.post("/api/query")
def ask_model(query: Query):
    if rag is None:
        raise HTTPException(status_code=500, detail="RAG not initialized")

    try:
        response = rag.prompt(query.question)

        return {
            "ok": True,
            "answer": response.get("answer", response),
            "source": response.get("source", []),
        }

    except Exception as e:
        logger.exception("Error processing query")
        raise HTTPException(status_code=500, detail=str(e))

# Run the app with: uvicorn src.rag.api:app --host
if __name__ == "__main__":
    uvicorn.run("rag.api:app", host="0.0.0.0", port=5000)
