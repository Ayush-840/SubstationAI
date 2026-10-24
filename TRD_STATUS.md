# TRD execution status (short)

This is the one-page summary of where the 15-day TRD sprint (v4.0,
`TRD (1).md`) stands against the actual repo on `main`. The full day-by-day
status table is in `TRD (1).md` §6.

## What is done (code + docs)

- MongoDB added and wired (Day 3–5): `docker-compose.yml`, `app/db/mongo.py`,
  `app/db/mongo_repos.py`, conversation/message/feedback/fault-log collections.
  `fault_logs` is the Mongo system of record (no SQLite table).
- Redis added and wired (Day 9): `docker-compose.yml`, `app/cache/redis_cache.py`.
  Catalog + answer cache, deny-list, and rate-limiter backend all use Redis when
  available and fall back to in-memory otherwise.
- Engineer role + RBAC + ownership (Day 7): seed, migration, `require_role` gate on
  `/api/diagnosis`, ownership scoping on conversation/feedback/procedure-run.
- Refresh-token rotation + logout deny-list (Day 6): `app/api/auth.py` +
  `app/core/refresh.py` + `app/core/denylist.py`. Logout is `async def` and
  `await`s the deny-list revoke.
- `/api/v1` prefix + pagination/filtering/sorting (Day 1–2): `app/api/v1/` router
  mounted alongside legacy routes; `ListingParams` in `app/api/deps.py`.
- Result Checker (Day 8): `app/tools/result_checker.py`, numeric (within /
  borderline / outside) and qualitative ("see criterion") branches, exposed at
  `POST /api/diagnosis/check-result` and `POST /api/diagnosis/tools/check-result`.
- Rate limiting + CORS + security headers (Day 8): `app/core/security_middleware.py`.
  CORS uses an exact allow-list **plus** an optional origin regex for any
  `*.vercel.app` preview URL.
- Evidence pack: `docs/DB.md` rewritten to match the real stack (SQLite primary,
  Mongo secondary, Redis cache/deny-list), with real queries, real Mongo shapes,
  embed-vs-reference rationale, `$lookup` example, and the ObjectId type-match note.
- Tests: backend suite green locally (106 passed in the latest run).

## The one bug found during deployment smoke test and fixed

`ModuleNotFoundError: No module named 'redis'` on Render startup. Root cause:
`redis` was only mentioned in a comment in `backend/requirements.txt`, and both
Dockerfiles installed only `requirements.txt`. Fixed by moving `redis>=5.0.0` into
the core requirements and having both Dockerfiles install `requirements.txt` +
`requirements-heavy.txt`. Pushed to `main`.

## Still required (manual dashboard steps, not code)

1. **Vercel — set `VITE_API_URL`.** Project settings → Environment Variables:
   `VITE_API_URL` = `https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com`.
   Without it the frontend has no API base URL in production.
2. **Render — set `MONGO_URL`.** Backend service → Environment: paste the MongoDB
   connection string. `render.yaml` declares it `sync: false`, so it is never
   auto-filled.

After both are set, restart the services and smoke-test the login endpoint with
the demo trainee account (`demo@substationiq.dev` / `demo1234`).

## Not yet done (sprint tail)

- Day 13: re-run `eval/run_eval.py` + update metrics + cache-latency note.
- Day 14: fill `RUBRIC_CHECKLIST.md` Evidence columns.
- Day 15: fresh-clone smoke test, demo video, tag.
