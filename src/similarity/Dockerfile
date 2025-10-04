FROM python:3.11-slim

WORKDIR /app
COPY . .

# dependências do sistema (compilação leve)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip setuptools wheel

# versões compatíveis e estáveis
RUN pip install \
    fastapi==0.115.0 \
    uvicorn==0.30.6 \
    numpy==1.26.4 \
    scikit-learn==1.5.1 \
    sentence-transformers==3.0.1 \
    transformers==4.44.2 \
    huggingface_hub==0.24.6

EXPOSE 8080
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
