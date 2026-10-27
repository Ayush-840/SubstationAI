# Render builds this file (build context = repo root).
#
# Two image flavours, same file:
#   default (INSTALL_HEAVY=false)  small image, boots in seconds, designed for Render's 512 MB free instance.
#                                  Catalog, procedures, diagnosis, auth, history all work; document
#                                  upload/semantic search degrade gracefully (the app logs
#                                  "document retrieval disabled").
#   INSTALL_HEAVY=true             adds torch/sentence-transformers/chromadb/spaCy/OCR (several GB,
#                                  needs >= 2 GB RAM). Use on a paid instance or locally:
#                                  docker build --build-arg INSTALL_HEAVY=true .
FROM python:3.11-slim

ARG INSTALL_HEAVY=false
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && if [ "$INSTALL_HEAVY" = "true" ]; then \
         apt-get install -y --no-install-recommends gcc libpq-dev tesseract-ocr libtesseract-dev poppler-utils; \
       fi \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements-heavy.txt ./
RUN pip install -r requirements.txt \
    && if [ "$INSTALL_HEAVY" = "true" ]; then \
         pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-heavy.txt; \
       fi \
    # Fail the build (seconds) -- not a 15-minute "no open ports" timeout -- if a startup import is missing.
    && python -c "import fastapi, uvicorn, slowapi, redis, sqlalchemy, psycopg2, motor, yaml, rapidfuzz, reportlab, jose, passlib, bcrypt"

COPY backend/ ./
# Static data lives outside /app/data so a mounted disk cannot shadow it (see app/core/paths.py).
COPY data/catalog/ /app/catalog/
COPY data/raw_docs/ /app/raw_docs/

EXPOSE 8000

# 1) idempotent seed (catalog; demo users only if SEED_DEMO_USERS=true), 2) API on $PORT.
# --proxy-headers / --forwarded-allow-ips: behind Render's proxy each request would otherwise
# appear to come from the proxy's IP, so every user would share one rate-limit / lockout bucket.
CMD sh -c "python -m app.scripts.seed || true; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"
