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
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application (includes backend/ and data/ from repo root)
COPY . .

EXPOSE 8000

# Seed once if the DB is empty (idempotent), then start the API.
CMD sh -c 'cd backend && python -m app.scripts.seed || true && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'
