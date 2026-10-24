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

# Install Python dependencies (core + heavy; the app imports from both)
COPY backend/requirements.txt backend/requirements-heavy.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-heavy.txt

# Copy application code
COPY backend/ ./

# Copy static data (catalog YAML + sample docs) to a path that survives
# the Render disk mount at /app/data (which would otherwise shadow them).
COPY data/catalog/ /app/catalog/
COPY data/raw_docs/ /app/raw_docs/

EXPOSE 8000

# Seed once if the DB is empty (idempotent), then start the API.
CMD sh -c 'python -m app.scripts.seed || true && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'
