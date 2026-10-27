# TRD — Fixing the Render + Vercel deployment of SubstationIQ

| | |
|---|---|
| Version | 1.0 (27 Oct 2026) |
| Applies to | `main` at commit `57e11f2` and the patch that accompanies this document |
| Scope | Render (FastAPI backend), Vercel (React/Vite frontend), and the register / login flow that sits across both |
| Evidence rule | Every finding is marked **Reproduced** (I ran it), **Measured** (taken from package metadata or the docs), or **Inferred** (likely, but I could not see your Render/Vercel logs) |

---

## 1. Summary

The site fails in three independent places. Fixing only one of them still leaves a broken site, which is why it has felt like "it keeps breaking".

| # | Where | What a user sees | Root cause | Evidence |
|---|-------|------------------|------------|----------|
| F1 | Vercel | Blank white page for everyone | `copy.components` / `copy.errors` do not exist (the strings live under `copy.pages.*`), so React throws while loading `SafetyBlock` and renders nothing | **Reproduced** in headless Chromium on current `main`: `TypeError: Cannot read properties of undefined (reading 'safetyBlock')` |
| F2 | Render ↔ browser | "Failed to fetch" on register and login | `CORS_ALLOW_ORIGINS` / `CORS_ALLOW_ORIGIN_REGEX` are **not fields of `Settings`**, so `getattr(settings, ..., "")` always returns `""`. The env vars in `render.yaml` are ignored and only `localhost` is allowed | **Reproduced**: preflight from your Vercel origin returned `400 Disallowed CORS origin` |
| F3 | Render build / boot | Build timeout, out-of-memory, or "No open ports detected" | The Dockerfile installs `requirements-heavy.txt` (torch, sentence-transformers, chromadb, spaCy, OCR) on a free 512 MB instance. The app does not need them to start | **Reproduced** that the app imports in 1.2 s, seeds in 6 s and uses ~114 MB RAM without them. **Measured**: the default Linux `torch` pulls ~555 MB plus `triton` 248 MB and CUDA libraries (cudnn 766 MB, cublas 581, cusparse 366, nccl 352, cusolver 338, cufft 201 …), i.e. well over 3 GB. The failure itself is **Inferred** (no Render logs seen) |
| F4 | Render blueprint | Blueprint rejected, or services not created | `render.yaml` puts Redis under `databases:` and has a top-level `disk:`. In the Blueprint spec a Redis-compatible store is `type: keyvalue` under `services:`, and `disk` belongs to a single service | **Measured** against Render's YAML reference. Free web services do not support persistent disks (verify in your dashboard) |
| F5 | Vercel routing | Refreshing `/chat` or opening a deep link gives 404 | `vercel.json` sits in the repo root, but the project is named `frontend`, so its Root Directory is almost certainly `frontend`. Vercel reads `vercel.json` from the Root Directory, so the SPA rewrite is never applied | **Inferred** (project name). Cheap to confirm in Settings → General → Root Directory |
| F6 | Vercel → Render | Every API call fails even after F1/F2 are fixed | The documented `VITE_API_URL` is `https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com`. A Render URL is `<service-name>.onrender.com`; the `-h8ikkpyfy-…-projects` shape is how **Vercel** names deployments. Also, if `VITE_API_URL` is empty, the catch-all rewrite answers `/api/...` with `index.html` | **Inferred**. I could not resolve either host from my sandbox (outbound traffic is allow-listed) |
| F7 | Render proxy | One user's failed logins lock everyone out | uvicorn was started without `--proxy-headers`, so every request appears to come from Render's proxy IP and all users share one rate-limit bucket | **Reproduced** the limiter behaviour (5/min per IP); proxy effect is standard behaviour |
| F8 | Auth quality | Weak passwords accepted, register answers 200, no replay protection, logout did not revoke the access token | See `AUTH` appendix | **Reproduced**, fixed, 25 regression tests added |

---

## 2. Goals and non-goals

**Goals**
1. Register → login → use the app works end to end on Vercel + Render **free** tiers.
2. A wrong environment variable fails the *build* with a readable message, not the user's browser.
3. The backend image builds in minutes and runs inside 512 MB.
4. Every fix has an automated test or a one-line check you can run yourself.

**Non-goals** (listed so nobody tries to fix them in this sprint): semantic document search on the free tier, multi-region, SSO, email verification.

---

## 3. Design decisions

### 3.1 CORS (fixes F2)
* `Settings` gains `CORS_ALLOW_ORIGINS`, `CORS_ALLOW_ORIGIN_REGEX`, `APP_ENV`, and `extra="ignore"` so a new key in `.env` can never crash startup again.
* `FRONTEND_URL` is always an allowed origin.
* Origins may contain `*` which matches **one** DNS label (so `https://*.vercel.app` cannot match `https://a.b.vercel.app` or `https://x.vercel.app.evil.com`).
* `CORS_ALLOW_ORIGIN_REGEX` is validated with `re.compile` at startup; a bad pattern stops the boot instead of failing the first preflight.
* **Do not use `https://.*\.vercel\.app`** in production: it allows every site hosted on Vercel. `render.yaml` ships the tight pattern `https://frontend-[a-z0-9-]*ayush-840s-projects\.vercel\.app`, which I tested against your production URL, a preview URL, and two hostile origins.
* Tokens travel in the `Authorization` header, not cookies, so CORS here does not carry ambient credentials.

### 3.2 Backend image (fixes F3)
* One `Dockerfile` with `ARG INSTALL_HEAVY=false`. Default = `requirements.txt` only. `--build-arg INSTALL_HEAVY=true` adds the ML stack (CPU-only torch index) for a paid instance or local use.
* The build ends with an import check, so a missing package fails the build in seconds.
* `CMD` seeds (idempotent), then `exec uvicorn … --proxy-headers --forwarded-allow-ips='*'` (fixes F7).
* Seeding creates **no demo users** unless `SEED_DEMO_USERS=true`; production refuses to start with that flag on.
* `DATABASE_URL` accepts `postgres://` (rewritten to `postgresql://`) and the engine uses `pool_pre_ping=True`, because free Postgres closes idle connections.

### 3.3 `render.yaml` (fixes F4)
* `services:` → web (Docker, `healthCheckPath: /health`) + `type: keyvalue` (Redis, `ipAllowList: []` = internal only).
* `databases:` → Postgres only. No `disk`.
* `APP_ENV=production` turns on `assert_production_ready()`: JWT secret ≥ 32 chars and not a placeholder, CORS configured, demo users off.
* `JWT_EXPIRE_MINUTES=15` (was 1440). The refresh token (7 days, rotating) keeps people signed in.

### 3.4 Vercel (fixes F1, F5, F6)
* F1: the 15 call sites now read `copy.pages.components.*` / `copy.pages.errors.*`; missing imports in `Login.tsx`, `common.tsx`, `Learn.tsx` added; the remaining type errors fixed so the build runs a **real** `tsc --noEmit` (it previously used `--noCheck`, which is how the crash shipped).
* F5: `vercel.json` moves to `frontend/` and the rewrite excludes `/assets/`. The root copy is deleted.
* F6: `frontend/scripts/check-env.mjs` runs as `prebuild`. On Vercel it fails the build if `VITE_API_URL` is empty, not `https://`, points at localhost, or ends in `/api`. `api/client.ts` also strips a trailing `/`.
* Also fixed while testing: navigation tabs changed a state variable but never the URL, so every tab showed the Chat page; they are now real routes, and a trainee typing `/dga` is redirected home.

### 3.5 Session handling in the browser
Access token in memory; refresh token in `localStorage` (the SPA and API are on different sites, so an HttpOnly cookie would be blocked as third-party). One shared refresh on 401 followed by one retry; sign out **only** when the server says the refresh token is invalid, never on a network error or cold start; readable messages for 422 arrays, `{detail}` and 429; "server is waking up" text while Render cold-starts.

---

## 4. Runbook (do these in order)

### 4.1 Render
1. Commit the patch to `main`. Do **not** keep the old blueprint: in Render, delete the old `substationiq-api` service if it never went healthy.
2. Dashboard → **New → Blueprint** → pick the repo. It creates the web service, the Postgres database and the Key Value store.
3. When prompted, set the `sync: false` variables: `MONGO_URL` (optional; leave blank to run without Mongo), `GEMINI_API_KEY` (optional; without it the app answers from the catalog in template mode).
4. Wait for **Live**. Copy the URL at the top of the service page. That exact string is your `VITE_API_URL`.
5. Check: `curl https://<service>.onrender.com/health` → `{"status":"healthy",…}`. First call after idle can take ~30–60 s.
6. If the deploy fails, open **Logs** and search for the first `ERROR`/`Traceback`. The build now prints `ModuleNotFoundError` immediately instead of a 15-minute port timeout.

### 4.2 Vercel
1. Project → Settings → General → **Root Directory = `frontend`**.
2. Settings → Environment Variables (Production **and** Preview): `VITE_API_URL = <the Render URL from 4.1>`. Leave `VITE_DEMO_MODE` unset (or `false`) in production.
3. Deployments → latest → **Redeploy → untick "Use existing Build Cache"**. `VITE_*` values are baked in at build time; changing them without a rebuild does nothing.
4. If the build stops with `Build stopped by scripts/check-env.mjs`, the message tells you which rule failed.
5. Back on Render, set `FRONTEND_URL` and `CORS_ALLOW_ORIGINS` to the production URL Vercel shows (`render.yaml` already has `https://frontend-h8ikkpyfy-ayush-840s-projects.vercel.app`; change it if your production domain differs).

### 4.3 Smoke test on the live site (2 minutes)
```bash
API=https://<service>.onrender.com
WEB=https://frontend-h8ikkpyfy-ayush-840s-projects.vercel.app
curl -s  $API/health
curl -si -X OPTIONS $API/api/auth/login -H "Origin: $WEB" \
     -H 'Access-Control-Request-Method: POST' | grep -i "^HTTP\|allow-origin"   # 200 + your origin
curl -s  -X POST $API/api/auth/register -H 'content-type: application/json' \
     -d '{"name":"Test","email":"t@example.com","password":"goodpass1"}'        # 201
```
Then in the browser: register, reload the page (stays signed in), open `/history` directly (no 404), sign out.

---

## 5. Verification already done

| Check | Result |
|-------|--------|
| Backend test suite on the patched `main` | **131 passed** (was 106 on the old tree; new tests cover CORS env wiring, regex validation, password policy, throttle, token type/expiry, replay detection, logout) |
| Patched backend started with `APP_ENV=production`, core deps only, behind `--proxy-headers` | `/health` OK; preflight from the Vercel origin → **200** with `access-control-allow-origin`; preview URL → 200; `evil.vercel.app` → 400; weak password → 422; register → 201; login → 200 with `Cache-Control: no-store` and HSTS |
| Memory / boot | ~114 MB RSS after requests; import 1.2 s; seed 6 s (catalog found at `/app/catalog`, the Docker layout) |
| Frontend `npm ci && npm run build` with real type-check | passes; `prebuild` guard rejects empty / localhost / `/api` URLs and accepts a valid one |
| Headless Chromium against built frontend + backend | login page renders (was blank); register → auto-login → reload keeps session → logout → wrong password and unknown e-mail give the same message → case-insensitive login; tab navigation changes the route; with a 1-minute access token, two simultaneous 401s caused **one** refresh and both requests were retried successfully |

**Not verified (cannot be, from my environment):** a real Docker build (no daemon here), your live Render/Vercel logs, your live URLs. Treat F3, F5 and F6 as the most likely explanations until you confirm them with 4.1–4.3.

---

## 6. Risks and how to handle them

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Render free web service sleeps after ~15 min idle | First request 30–60 s; looks like "login broken" in a viva | UI shows a waking-up message; ping `/health` from a free uptime monitor 5 min before a demo |
| Free Postgres is time-limited by Render | Accounts disappear when it expires | Export/seed script is idempotent; re-create before the viva; keep `SEED_DEMO_USERS=false` and register a fresh user |
| Document upload / semantic search disabled on the slim image | Catalog, procedures, diagnosis, auth and history still work; uploaded PDFs are not indexed | Build with `INSTALL_HEAVY=true` on a paid instance, or demo locally with Docker Compose |
| In-memory failed-login lockout resets on restart and is per instance | Brute-force protection is weaker after a redeploy | Redis storage is already used for slowapi when `REDIS_URL` is reachable; move the lockout to Redis if you scale past one instance |
| Mongo not configured | Features that use it are off | Set `MONGO_URL` (Atlas free tier) when you need them |

Rollback: every change is in one branch; revert the merge commit and Render/Vercel redeploy the previous version. The database schema is not changed by this patch.

---

## 7. Work plan (one commit per item, for the daily-commit portal)

| Day | Commit message | Files |
|-----|----------------|-------|
| 1 | `fix(frontend): resolve copy paths and missing imports so the app renders` | `copy` call sites, `Login.tsx`, `common.tsx`, `Learn.tsx` |
| 1 | `build(frontend): enable real type-check and fix remaining type errors` | `package.json`, pages |
| 1 | `feat(frontend): single-flight token refresh, readable errors, real routes for tabs` | `api/client.ts`, `auth.tsx`, `App.tsx` |
| 2 | `fix(api): wire CORS settings and validate origin regex at startup` | `config.py`, `security_middleware.py`, tests |
| 2 | `fix(auth): password policy, 201 on register, replay detection, logout revokes access token` | `auth.py`, `schemas`, `security.py`, `refresh.py`, `login_throttle.py`, tests |
| 2 | `build(docker): slim default image, proxy headers, build-time import check` | `Dockerfile`, `backend/Dockerfile`, `docker-compose.yml` |
| 3 | `fix(deploy): valid render blueprint, vercel.json in frontend, env guard` | `render.yaml`, `frontend/vercel.json`, `scripts/check-env.mjs`, `deployment-notes.md` |
| 3 | `docs: deployment TRD and live smoke-test results` | this file |

---

## 8. Appendix — register / login contract (what the code now guarantees)

| Endpoint | Success | Errors |
|----------|---------|--------|
| `POST /api/auth/register` `{name,email,password}` | **201** user (role is always `trainee`) | 409 duplicate (case-insensitive); 422 weak input; 429 rate limit |
| `POST /api/auth/login` | 200 `{access_token, refresh_token, token_type}` | 401 `Invalid email or password` (identical for unknown e-mail and wrong password, with equalised timing); 429 with `Retry-After` after 5 failures per IP+e-mail in 15 min |
| `POST /api/auth/refresh` `{refresh_token}` | 200 new pair; old token revoked | 401 invalid/expired; using an already-rotated token after a 10 s grace window **revokes all of that user's sessions** |
| `POST /api/auth/logout` | 200, idempotent, works with an expired access token | 401 only when no credentials at all |
| `GET /api/auth/me` | 200 | 401 |

* Password: 8–128 characters, ≤ 72 UTF-8 bytes (bcrypt limit), at least one letter and one digit, not on the common-password list.
* E-mail: trimmed and lower-cased; looked up with `lower(email)`. Optional follow-up: add a unique index on `lower(email)` in a migration.
* Access token: HS256, 15 minutes, claims `sub, jti, iat, exp, typ=access`; a refresh token can never be used as an access token.
* Refresh token: opaque random value, only its SHA-256 is stored, 7 days, rotated on every use.
* Next step if time allows: argon2 with transparent re-hash on login.
