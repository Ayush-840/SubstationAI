# Contributing

## Ground rules

1. One concern per commit; message style: `type(scope): what changed`
   (examples: `fix(api): wire CORS settings`, `feat(auth): TOTP two-factor authentication`).
2. Never commit secrets. `.env`, API keys and database credentials stay out of
   the repo; use `.env.example` as the template.
3. Do not print passwords or demo credentials in docs, READMEs or demo slides.
4. Backend changes need a test. Frontend changes need `npm run typecheck`.

## Setup

```bash
cp .env.example .env            # then edit values
pip install -r backend/requirements.txt
cd frontend && npm ci
```

## Checks before pushing

```bash
cd backend && pytest -q         # full suite must pass
cd frontend && npm run typecheck && npm run build
```

CI (`.github/workflows/ci.yml`) runs both on every push and pull request.

## Commits

Each team member commits under their own account. Split by module
(auth, catalog/procedures, RAG/frontend/deploy) so every viva answer maps to a
real owner — see `FINDINGS_AND_IMPROVEMENTS.md` §3.5.

## Where things live

| Area | Path |
|------|------|
| Auth, sessions, MFA | `backend/app/api/auth.py`, `backend/app/core/{security,refresh,login_throttle,mfa}.py` |
| Audit log | `backend/app/core/audit.py`, `auth_events` table |
| Schema changes | `backend/app/db/models.py` + idempotent migrations in `backend/app/db/migrate.py` |
| Deployment | `render.yaml`, `frontend/vercel.json`, `DEPLOY_FIX_TRD.md` |
| UI redesign | `docs/ui-redesign/` |
