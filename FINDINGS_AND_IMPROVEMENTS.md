# SubstationIQ — Errors found, improvement ideas, and how to present it for PPO / PPI

Reviewed: `main` @ `8b3570b` (27 Oct 2026). "Fixed" means fixed in `substationai-deploy-fix.patch` and covered by tests or a browser run. "Open" means not changed yet.

---

## 1. Errors found

### 1.1 Breaks the product for users
| # | Error | Evidence | Status |
|---|-------|----------|--------|
| E1 | Blank page: code reads `copy.components` / `copy.errors`, which don't exist | Reproduced in Chromium: `Cannot read properties of undefined (reading 'safetyBlock')` | Fixed |
| E2 | CORS env vars ignored (`Settings` has no such fields), so the Vercel origin is blocked | Reproduced: preflight → 400 | Fixed + regression test |
| E3 | Dockerfile installs torch/CUDA/spaCy/OCR (>3 GB of downloads) for an app that runs in ~114 MB without them | Measured from package metadata; app boot reproduced | Fixed (slim default image, heavy stack opt-in) |
| E4 | `render.yaml` structurally invalid (Redis under `databases`, top-level `disk`) | Checked against Render's YAML reference | Fixed |
| E5 | Navigation tabs changed a state variable, never the route — every tab showed Chat | Reproduced in browser | Fixed |
| E6 | `vercel.json` in the repo root while the project root is `frontend` (deep links 404) | Inferred from project name | Fixed (moved to `frontend/`) |
| E7 | `VITE_API_URL` missing/wrong gives a site whose API calls return `index.html` | Reasoned from the catch-all rewrite | Fixed (build now fails with a message) |
| E8 | Documented API URL (`backend-h8ikkpyfy-…onrender.com`) doesn't look like a Render host | Inferred | Open — **you** must copy the real URL from Render |

### 1.2 Auth and security
| # | Error | Status |
|---|-------|--------|
| S1 | Logout didn't deny-list the access token (coroutine never awaited); expired token could not log out | Fixed |
| S2 | Weak passwords accepted (`"x"`), register returned 200, e-mail case-sensitive duplicates | Fixed |
| S3 | Frontend: no token refresh, stale UI after expiry, "[object Object]" errors, logout on any network error (Render cold start) | Fixed |
| S4 | Rate limit shared by all users behind the proxy (no `--proxy-headers`) | Fixed |
| S5 | Public demo/admin credentials (`admin@substationiq.dev / admin1234`) in README, `BUILD_GUIDE.md`, `Login.tsx`, seed | Partly fixed: seeding and the login-page box are now opt-in (`SEED_DEMO_USERS`, `VITE_DEMO_MODE`); **delete the credentials from the markdown files** |
| S6 | `JWT_EXPIRE_MINUTES=1440` (24 h access token) | Fixed (15 min) |
| S7 | CORS wildcard `https://.*\.vercel\.app` would trust every Vercel site | Fixed (project-specific pattern) |
| S8 | No audit log, no e-mail verification, no password reset, no MFA | Open → `AUTH_TRD.md` |

### 1.3 Code quality
| # | Error | Status |
|---|-------|--------|
| Q1 | ~75 TypeScript errors hidden by `tsc --noCheck` in the build script | Fixed (0 errors, build type-checks) |
| Q2 | `Login.tsx` duplicated the whole form for desktop and mobile (two sets of inputs and ids) | Fixed |
| Q3 | Two `SourcesPanel` instances rendered at once | Fixed |
| Q4 | Chat endpoint `UnboundLocalError` on `conversation_mode` | Fixed |
| Q5 | `docker-compose.yml` started a `worker` (`app.worker`) that does not exist; duplicate env keys | Fixed |
| Q6 | `.env.example` keys crashed `Settings` (`extra` forbidden) | Fixed |
| Q7 | Procedures page showed `run.operator`, a field the API never sends | Fixed (shows the signed-in user) |
| Q8 | `postgres://` URL scheme (rejected by SQLAlchemy 2) and dropped idle connections on a free DB | Fixed (normalised, `pool_pre_ping`) |
| Q9 | Seed script printed demo passwords even when it created none | Fixed |

### 1.4 Repository hygiene (affects marks and first impressions)
| # | Finding | Fix |
|---|---------|-----|
| H1 | Root folder holds junk: `gemini-code-*.md/.json/.txt/.py`, `TRD (1).md`, `TRD copy.md`, `DB copy.md`, `README_.md`, seven `archive_*.md` | Delete or move to `docs/archive/`; one canonical README, PRD, TRD |
| H2 | Commit messages like `,` / `day 8` / `phase4` / `deploy` | Use `type(scope): what changed` (examples in the TRDs) |
| H3 | 51 of 52 commits by one author, but the course assigns a team of 3 and runs a group viva | Split work by module and commit under each person's own account **from now on** (no rewriting history) |
| H4 | No CI | Add the workflow in §2.1 |
| H5 | No `SECURITY.md` or `CONTRIBUTING.md` | 10-minute task, looks professional |

---

## 2. Improvement ideas (ordered by value per hour)

### 2.1 Do first (≤ 1 day each)
1. **CI on every push** — a GitHub Actions workflow running `pytest`, `npm run typecheck`, `npm run build`. A green badge in the README is the cheapest credibility signal.
   ```yaml
   # .github/workflows/ci.yml
   name: ci
   on: [push, pull_request]
   jobs:
     backend:
       runs-on: ubuntu-latest
       defaults: { run: { working-directory: backend } }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with: { python-version: '3.11', cache: pip }
         - run: pip install -r requirements.txt
         - run: pytest -q
     frontend:
       runs-on: ubuntu-latest
       defaults: { run: { working-directory: frontend } }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20, cache: npm, cache-dependency-path: frontend/package-lock.json }
         - run: npm ci
         - run: npm run typecheck
         - run: npm run build
   ```
2. **Cold-start friendliness** — free Render sleeps. Ping `/health` from a free uptime monitor every 10 min during demo week; the UI already shows a "server waking up" message.
3. **Smoke-test script** (`scripts/smoke.sh`) with the three curl commands from `DEPLOY_FIX_TRD.md §4.3`, run after each deploy.
4. **Remove the secrets-looking items from docs** (S5) and rotate any real keys that ever appeared in history.
5. **Redis ping on every authenticated request** (deny-list check) adds latency: cache "not revoked" for a few seconds, or skip when Redis is unreachable by design (decide and document the failure mode: fail-open vs fail-closed).

### 2.2 Product (what makes the site better for a real user)
* **Answer quality you can measure:** you already have an evaluation harness folder. Publish a table — retrieval hit-rate and "answers with a citation" over a fixed question set — in the README and re-run it in CI. Numbers beat adjectives in interviews.
* **Safety-first UX for substation work:** show the isolation/permit-to-work reminder before any procedure step list, require an explicit "isolation verified" tick before the checklist unlocks, and put a visible "Not a substitute for your site procedure" footer (partly present).
* **Offline-tolerant procedures:** cache the opened procedure in the service worker so a technician in a switchyard with poor signal can finish a checklist; sync when back online.
* **Result Checker:** let the user save a test reading and show trend over time per equipment tag (simple line chart) — turns a calculator into a maintenance log.
* **Search UX:** type-ahead over equipment and test names; synonyms (IR/insulation resistance, BDV/breakdown voltage) are already in the NLP layer, expose them as suggestions.
* **Role-aware home:** trainee sees Learn/quiz progress, engineer sees Diagnose/DGA, admin sees content review queue.
* **Accessibility pass:** keyboard order, focus rings, contrast in the outdoor theme, `aria-live` for streamed answers. Run Lighthouse and quote the score.

### 2.3 Engineering depth (shows in interviews)
* **Observability:** structured JSON logs with a request id, a `/metrics` endpoint (request count, latency, 429s, login failures) and a tiny dashboard page.
* **Database:** add the unique index on `lower(email)`, Alembic migrations for every schema change (one already exists), and a backup/restore note for the free Postgres.
* **Load test:** 5-minute `k6`/`locust` run on login and catalog endpoints; record p95 latency and the instance that falls over first.
* **Security checklist run:** OWASP ASVS Level 1 — tick each item in a table; it doubles as viva preparation (`AUTH_TRD.md` maps the auth part).
* **Feature flags** for the heavy RAG stack: `ENABLE_DOCS=true` only on a bigger instance, with a clear message in the UI when off.

---

## 3. Turning this into a PPO / PPI story

Interviewers rarely care that a project is large; they care whether you can explain a decision and show evidence.

### 3.1 Evidence you can already truthfully claim
* Diagnosed a production deployment that failed in three independent places (frontend crash, CORS misconfiguration, oversized image) by reproducing each locally.
* Cut the backend to run in ~114 MB RAM with a 1.2 s import time by making the ML stack optional (measured locally; re-measure on Render and quote that figure instead).
* 131 automated backend tests, TypeScript strict build with 0 errors, headless-browser end-to-end run of register → reload → logout → expired-token refresh.
* Implemented refresh-token rotation with replay detection, per-(IP+e-mail) lockout and user-enumeration-safe login.

### 3.2 Resume bullets (edit the numbers to what *you* measure)
* "Built SubstationIQ, an AI maintenance assistant for substation engineers (FastAPI, React, PostgreSQL, Redis, hybrid RAG), deployed on Render and Vercel."
* "Designed JWT + rotating refresh-token authentication with replay detection, rate limiting and audit logging; 131 automated tests."
* "Debugged a three-part production outage (CORS config, build crash, 3 GB image) and reduced the API runtime footprint to ~114 MB."

### 3.3 Five-minute demo script
1. Open the site cold (explain the free-tier wake-up while it loads).
2. Register → (after the auth TRD) verify e-mail → sign in with MFA.
3. Ask a maintenance question → show the cited sources and the safety block.
4. Run a procedure checklist → export the PDF.
5. Show the audit log and the CI badge. Close with "what I would do next" (offline mode, trend charts).

### 3.4 Questions to rehearse (answers are in the TRDs)
Why FastAPI? Why JWT plus refresh tokens? What does CORS protect and why did it break login? How do you stop brute force without locking real users out? What happens when Redis is down? How would you scale this beyond one instance? What would you not build in a safety-critical domain, and why does the app refuse to answer outside its verified catalog?

### 3.5 Team-of-3 split that makes the group viva safe
| Person | Owns | Must be able to explain |
|--------|------|-------------------------|
| A | Auth + admin + audit | `AUTH_TRD.md` end to end |
| B | Catalog, procedures, Result Checker, database | schema, indexes, migrations, queries |
| C | RAG/chat, frontend UX, CI/deploy | retrieval pipeline, evaluation table, deployment runbook |
Everyone reads all three summaries; each person commits only under their own account.

---

## 4. Suggested next 5 days
| Day | Task |
|-----|------|
| 1 | Apply the patch, follow `DEPLOY_FIX_TRD.md §4`, get a live green smoke test |
| 2 | Clean the repo (H1–H3), add CI, remove demo credentials from docs |
| 3 | Audit log + argon2id (`AUTH_TRD.md` days 1–2) |
| 4 | E-mail verification + password reset |
| 5 | Evaluation table in the README, 2-minute demo video |
