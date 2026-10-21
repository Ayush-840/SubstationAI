FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    tesseract-ocr \
    libtesseract-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# NOTE: heavy deps (chromadb, sentence-transformers, spacy) are optional — see requirements-heavy.txt
# cache-bust: 2026-10-21T06:40Z
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

EXPOSE 8000

# Seed once if the DB is empty (idempotent), then start the API.
CMD sh -c 'python -m app.scripts.seed || true && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'