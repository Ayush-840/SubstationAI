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

# Install Python dependencies (both files are required at runtime:
# redis is imported by the token deny-list, and the heavy stack is imported
# unconditionally by the routers and seed script).
COPY requirements.txt requirements-heavy.txt ./
# Fail the build (seconds) if a startup-time import is missing, instead of a
# 15-minute runtime "no open ports" timeout on Render.
RUN pip install --no-cache-dir -r requirements.txt -r requirements-heavy.txt \
    && python -c "import fastapi, uvicorn, slowapi, redis, sqlalchemy, motor, chromadb, sentence_transformers, spacy, reportlab, yaml, rapidfuzz"

# Copy application
COPY . .

EXPOSE 8000

# Seed once if the DB is empty (idempotent), then start the API.
CMD sh -c 'python -m app.scripts.seed || true && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'