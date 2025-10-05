FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ && rm -rf /var/lib/apt/lists/*

# Copia apenas o arquivo de requirements
COPY rag/requirements.txt ./rag/requirements.txt

# Instala as dependências
RUN pip install --no-cache-dir -r ./rag/requirements.txt

# Copia o restante do código
COPY . .

FROM python:3.11-slim

WORKDIR /app

# Copia as libs instaladas no builder
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin

# Copia o código da aplicação
COPY . .

EXPOSE 5000

ENV OLLAMA_URL=http://host.docker.internal:11434
ENV PATH="/usr/local/bin:$PATH"

CMD ["uvicorn", "rag.api:app", "--host", "0.0.0.0", "--port", "5000"]
