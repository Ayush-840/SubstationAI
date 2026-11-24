# Render builds this file (build context = repo root).
#
# The backend is Node.js + Express + Prisma (see backend/). This image:
#   1. installs the API dependencies,
#   2. generates the Prisma client,
#   3. applies the schema on boot, seeds catalog/XR rows (best effort),
#   4. starts the Express server on $PORT.
#
# The old Python/FastAPI image was removed when the backend was rewritten.
FROM node:20-slim

ENV NODE_ENV=production
WORKDIR /app

# Prisma needs OpenSSL at runtime; ca-certificates for HTTPS to the database.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json ./
RUN npm install

COPY backend/ ./
RUN npx prisma generate

EXPOSE 8000

# migrate deploy is the happy path. If the database was created with `db push`
# (no Prisma migration history), fall back to db push so the server can start.
# Seeding is idempotent; failures must not stop the API from booting.
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --skip-generate || true; node prisma/seed.js || true; node prisma/seed-xr.js || true; exec node server.js"]
