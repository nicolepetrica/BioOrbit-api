FROM python:3.10-slim AS base

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY similarity/requirements.txt ./similarity/requirements.txt

RUN pip install --no-cache-dir torch==2.3.0 torchvision==0.18.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r ./similarity/requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "similarity.api:app", "--host", "0.0.0.0", "--port", "8080"]
