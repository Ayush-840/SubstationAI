# Local/compose build (build context = ./backend). Render uses the Dockerfile at the repo root.
#
# Two image flavours, same file:
#   default (INSTALL_HEAVY=false)  ~300 MB, boots in seconds, fits Render's 512 MB free instance.
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

COPY requirements.txt requirements-heavy.txt ./
RUN pip install -r requirements.txt \
    && if [ "$INSTALL_HEAVY" = "true" ]; then \
         pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-heavy.txt; \
       fi \
    # Fail the build (seconds) -- not a 15-minute "no open ports" timeout -- if a startup import is missing.
    && python -c "import fastapi, uvicorn, slowapi, redis, sqlalchemy, psycopg2, motor, yaml, rapidfuzz, reportlab, jose, passlib, bcrypt, argon2"

COPY . .

EXPOSE 8000

CMD sh -c "python -m app.scripts.seed || true; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"
