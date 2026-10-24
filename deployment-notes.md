# Deployment notes

This file complements `render.yaml`, `vercel.json`, and the Dockerfiles with
the reasoning behind the deployment setup and the current status of each
concern. It is not consumed by Render or Vercel; it is for humans
maintaining this repo.

## Services

- **Frontend** → Vercel (static SPA, client-side routing).
- **Backend API** → Render (Docker web service, PostgreSQL + MongoDB + Redis
  + Chroma disk attached).

## Required environment variables

These must be set in the respective dashboards before the services work.

### Frontend (Vercel site settings → Environment Variables)

| Variable | Value | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com` | Must match the live backend URL. The current value in `frontend/.env.local` is empty, which breaks the API client in production. |
| `VITE_DEMO_MODE` | `true` | Optional. Shows demo credentials on the login page. |

`vercel.json` only configures rewrites; the API base URL comes from
`VITE_API_URL`. If that variable is missing or wrong, the login and chat
flows fail with network errors.

### Backend (Render dashboard → Environment)

Most variables are wired through `render.yaml` from the attached PostgreSQL,
MongoDB, and Redis services. The ones that are **not** auto-wired and must
be set explicitly:

| Variable | Notes |
| --- | --- |
| `MONGO_URL` | Render does not auto-generate this from the attached MongoDB service in the current `render.yaml`; paste the connection string from the Render MongoDB dashboard. |
| `MONGO_DB` | Defaults to `substationiq` in `config.py`; can be overridden. |

All other backend variables (`DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`,
`CORS_ALLOW_ORIGINS`, `CORS_ALLOW_ORIGIN_REGEX`, `CHROMA_PATH`,
`JWT_*`, `RATE_LIMIT_*`) are declared in `render.yaml` and are either auto
wired from attached services or set to reasonable defaults.

## CORS

The backend uses an exact allow-list (`CORS_ALLOW_ORIGINS`) plus an optional
regex (`CORS_ALLOW_ORIGIN_REGEX`). The regex is how we allow any
`*.vercel.app` preview URL without hardcoding the exact subdomain.

Current production values (from `render.yaml`):

- `CORS_ALLOW_ORIGINS=https://frontend-h8ikkpyfy-ayush-840s-projects.vercel.app`
- `CORS_ALLOW_ORIGIN_REGEX=https://.*\.vercel\.app`

If the Vercel project is recreated under a different URL, update
`FRONTEND_URL`, `CORS_ALLOW_ORIGINS`, and `VITE_API_URL` to match, and the
regex will continue to cover the new `*.vercel.app` subdomain.

## Chroma / vector store

Chroma persists under `CHROMA_PATH`, which defaults to `<DATA_DIR>/chroma`.
On Render, `DATA_DIR` resolves to `/app/data` (the attached disk), so the
vector store lives at `/app/data/chroma`. The disk is mounted at
`/app/data` in `render.yaml`; its name is `chroma-data`.

## Catalog and raw docs in the Docker image

The root `Dockerfile` copies `data/catalog/` to `/app/catalog/` and
`data/raw_docs/` to `/app/raw_docs/` inside the image. This is intentional:
the Render disk mount covers `/app/data`, which would otherwise shadow any
`/app/data/catalog` or `/app/data/raw_docs` copied into the image. The
catalog loader (`backend/app/core/paths.py`) checks `/app/catalog` and
`/app/raw_docs` after the disk paths, so the in-image copy is found on first
deploy and the seed script can load the YAML catalog even before any manual
upload.

## Root Dockerfile vs. backend Dockerfile

- `backend/Dockerfile` is the **source of truth** for the backend image. It
  is used for local development and is the reference for the root one.
- `Dockerfile` (repo root) is what Render builds by default (Render looks
  for a Dockerfile at the repo root when `render.yaml` says
  `runtime: docker`). It is kept in sync with `backend/Dockerfile` but
  adapted for a repo-root build context: it copies `backend/` and the
  `data/` tree rather than the entire repo.

Do not edit the root `Dockerfile` independently for backend changes; update
`backend/Dockerfile` first, then adjust the root one to stay consistent.

## Hot reload in development

The backend and frontend both run with auto-reload (`--reload` in uvicorn,
the default Vite dev server). Editing a Python file in `backend/` or a
TypeScript file in `frontend/src/` should reflect within a few seconds in a
local Compose or Vite dev session. This document does not affect that
behavior.
