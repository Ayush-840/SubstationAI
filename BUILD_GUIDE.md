# BUILD_GUIDE.md — How to Build SubstationIQ

Everything you need to go from zero to a deployed, fully documented capstone. Assumes an 8-week timeline; compress by cutting P1 features in the order: DGA tool, quizzes, PDF export.

---

## 0. Before You Write Code (Day 0 to 1)

1. **Confirm the idea** is on the official list, or get mentor approval in writing before implementing.
2. **Create the GitHub repo** (monorepo), add all three teammates, protect `main` (PR required).
3. **Make the first commit today.** Daily commits are tracked and cannot be backdated.
4. **Agree on conventions:** conventional commits, branch names `feat/<area>-<short-name>`, one PR per vertical slice, at least one reviewer.
5. **Create GitHub Issues** from the weekly plan below and a Project board (To do / Doing / Review / Done).
6. **Split roles** (see section 2) and pick catalog ownership per equipment class.
7. **Adopt the working 2-tier role vocabulary** (`trainee | engineer | admin`) from day one so follow-on work (RBAC, the Result Checker gate, ownership filters) does not have to retrofit it later. The old `user|admin` split is deprecated in this repo and the migration path is: `user` → `trainee`, `admin` stays `admin`, then add `engineer`.
8. **Decide on the two remaining manual deployment steps now**, because only a human with dashboard access can do them later: on Vercel set `VITE_API_URL` to your live backend URL; on Render set `MONGO_URL` to your MongoDB connection string (Render declares it as `sync: false` so it will never be auto-filled). If either is left unset, the deployed app is broken at runtime — the code checks for the value, it just cannot set it for you.

## 1. Repository Skeleton

```
substationiq/
├── backend/            # FastAPI app (see TRD section 3)
├── frontend/           # React app
├── data/
│   ├── catalog/        # one YAML per equipment class
│   └── raw_docs/       # source PDFs (keep small; large files via Git LFS or links)
├── db/schema.sql
├── eval/               # questions.jsonl, run_eval.py, results/
├── docs/               # PRD, TRD, DESIGN, DB, BUILD_GUIDE, RUBRIC_CHECKLIST, screenshots
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
└── README.md
```

## 2. Team Split and Daily Rhythm

For this repo the three members map to the roles as follows (the names are
placeholders — adjust to who actually owns what):

| | **A: Intelligence** | **B: Backend & Data** | **C: Frontend & Product** |
|---|---|---|---|
| Core | NLP, retrieval, LLM, guardrails, verifier, evaluation | FastAPI layers, auth/RBAC, SQLite + Mongo, Alembic, Redis, security, CI/CD, deploy, DB evidence pack | React app, all screens, SSE client, PDF export, E2E test, demo video, Result Checker UI |
| Catalog | Transformer + Reactor | Circuit Breaker | Instrument Transformer + Surge Arrester |
| Docs | Evaluation report | `docs/DB.md`, ER diagram, `docs/openapi.json` export | `docs/TRD.md`, `docs/BUILD_GUIDE.md`, `docs/RUBRIC_CHECKLIST.md`, README, user guide |

**Actual team roles already implemented in the repo:**
Backend & Data owns the SQL evidence (models, DDL, queries in `docs/DB.md`),
MongoDB (Motor repos, `app/db/mongo.py`, `app/db/mongo_repos.py`),
auth/RBAC (three roles, refresh rotation, deny-list, ownership checks, the
`/api/diagnosis` engineer gate), deployment configs (`docker-compose.yml`,
`render.yaml`, `vercel.json`, Dockerfiles, `.env.example`) and the README.
Frontend & Product owns the Result Checker page (`frontend/src/pages/ResultChecker.tsx`),
the History page (`frontend/src/pages/History.tsx`), the catalog-editor page
(from which admins draft `criterion_text`-only limits) and the deployment
wiring on the Vite side. Intelligence owns the eval harness, the retrieval
pipeline, the guardrails and the NLP intent/entity layer that are already in
the repo and are out of BUILD_GUIDE.md's scope.

**Daily rhythm**
- Everyone pushes at least one meaningful commit **every day** (a small vertical slice, test, doc, catalog entry, or fix all count).
- Two 15-minute syncs a week; one 45-minute **cross-training** session weekly where each person walks the others through their code (this is your viva preparation).
- Review each other's PRs within 24 hours.
- Never push a large block of work at the end; the ISD rubric gives 5 marks purely for consistent history.

## 3. Eight-Week Plan

This is the plan described in BUILD_GUIDE.md. In the actual repo, the sprint
was compressed into a 15-day compliance sprint (documented in `TRD (1).md`),
so treat this table as the **originating spec**. The "actual repo state" column
tells you what is already true on `main` today, so you can skip anything
green and focus on what is still open. Days are listed as **D1–D15** to match
the TRD; the week numbers are kept because the rubric teams may still refer to
them.

| Week | Spec says | Actual repo state (as of latest `main`) |
|---|---|---|
| **1** | A: sources + 40+ test list + catalog YAML; B: repo, Docker Compose, config, Postgres + Alembic, Mongo connection, health, CI; C: Vite app, routing, design tokens, login/register | Core of this is already done: the repo has 5 equipment classes and 40+ tests with steps/limits/instruments/standards/sources, ~300 synonyms, a working Docker Compose (PostgreSQL + MongoDB + Redis), `docker-compose.yml`, `render.yaml`, `.env.example`, `vercel.json`, Dockerfiles, a health endpoint, Alembic, and a Vite frontend with routing, auth screens, catalog pages and an SSE chat client. The catalog lives as YAML in `data/catalog/`, not in a Postgres DDL-only world. |
| **2** | A: first 20 tests + `validate_catalog.py` + embeddings model; B: auth (register/login/refresh/logout), users table, RBAC deps, error handler, response envelope; C: app shell, auth flow, catalog list/detail | Auth is done (register/login/refresh/logout, hashed refresh-token rotation, `jti` deny-list). RBAC is done (three roles, `require_role`, ownership checks). The repo already migrated from the legacy `user|admin` vocabulary to `trainee|engineer|admin`. The full **response envelope** described in BUILD_GUIDE.md is the target convention, not yet universal — list endpoints currently return data directly on legacy paths. Do not present a blanket envelope rule the code does not yet follow; the TRD documents that this is the target. |
| **3** | A: ingestion pipeline (parse/chunk/embed) + hybrid retrieval SQL + synonyms; B: catalog CRUD with pagination/filter/sort, ARQ worker, document upload; C: chat UI with SSE (mock first), equipment chips | Retrieval pipeline (Chroma + BM25 + reranking) is already in the repo. The synonym table and catalog CRUD are implemented. Chat uses **SSE streaming** in production (real tokens, not a mock). Equipment chips exist on the chat UI. |
| **4** | A: query understanding (normalise, entities, intent) + LLM wrapper; B: `/chat/stream`, conversations/messages in Mongo, Redis cache; C: structured answer card, citation panel, history | All three are done. MongoDB holds conversations/messages/feedback/fault_logs (`fault_logs` is the Mongo system of record — no SQLite table). Redis is wired (cache + deny-list + rate limiter, in-memory fallback when Redis is down so the app still starts). `/chat/stream` persists to Mongo and the History page reads from it. |
| **5** | A: answer assembler, guardrails, verifier, "not found" logic; B: rate limiting, security headers, procedure-runs API, feedback API; C: guided procedure UI, feedback UI, admin documents page | Done. Rate limiting (slowapi) on `/auth/login` (5/min) and `/chat/stream` (30/min), CORS allow-list + optional Vercel preview origin regex, security headers. Feedback API is Mongo-backed with a SQL mirror. Procedure runs are implemented. |
| **6** | A: finish catalog to 40+ tests, fault diagnosis; B: analytics, verification workflow, email (reset), scheduled jobs; C: Result Checker UI, catalog editor, verification queue | Done. Fault diagnosis (DGA rules) is implemented and writes `fault_logs`. Analytics endpoint (`GET /api/admin/analytics`, admin-only) exists and runs the real SQL aggregation shapes. The **Result Checker** is fully implemented: deterministic comparison (`check_result` / `check_numeric_limit`), numeric (within/borderline/outside) and qualitative (`criterion_text` → "see criterion"), with backend endpoint(s) and a working frontend page. The TRD says to cut DGA first under load; the reverse order (cut Result Checker last) is fine if that is the feature you want to keep. |
| **7** | A: DGA logic + tests, evaluation set/runs/ablations; B: quiz service, 70% service coverage, logging polish, load test; C: Learn mode UI, DGA triangle plot, analytics and eval pages | Done for the most part. DGA logic + tests exist. Evaluation harness (`eval/run_eval.py`) exists and is runnable; re-running it and updating the metrics table is the remaining Day-13 step. Quiz service and load test may still be open depending on where you stopped. |
| **8** | A: evaluation report + final tuning; B: deployment, seed data, backups, docs/OpenAPI export; C: E2E test, mobile polish, demo video, README screenshots | Deployment configs are in place (Render + Vercel + Docker). Seed data (5 classes, 40+ tests, synonyms, demo users per role, synthetic history) is implemented and runs at startup. `docs/DB.md` and `docs/openapi.json` are exported. README is overhauled. **Two manual steps remain** (see §5). E2E test, demo video and the final fresh-clone smoke test are still open. |

## 4. Getting the Catalog Data (Most Important Content Task)

1. Build the test list per equipment class first (names only), for example transformer: insulation resistance and polarisation index, winding resistance, turns ratio, tan delta and capacitance, DGA, oil breakdown voltage, oil moisture, SFRA, OLTC checks; similarly for the other classes.
2. For each test, collect **from real sources** (OEM manuals, public standards summaries, utility maintenance guides, CEA/CBIP public material, open-access papers): purpose, instruments, safety points, procedure steps, limits with conditions, standards, common issues and actions.
3. Record the **source** (document, page, section) alongside every limit and standard as you enter it.
4. Run the catalog validation in CI: it fails if any limit has no source, any test lacks steps or safety notes, or any unit is missing. In this repo the catalog lives as YAML under `data/catalog/` and the loader is `backend/app/catalog/loader.py`.
5. Ask an electrical-department faculty member or a lab instructor to spot-check a sample. Mention this review in the report.
6. Never fill limits from memory or from an LLM. Mark uncertain entries `draft`; only verified entries power answers. The same rule applies to qualitative limits entered via the catalog editor: a `criterion_text`-only limit (no min/max) is fine — it is a real constraint, just expressed in words.

## 5. Day-1 Setup (copy and adapt)

This is the original Day-1 setup from BUILD_GUIDE.md. In this repo the stack is
real and slightly different: the primary DB is SQLite (with a PostgreSQL DDL
submitted as evidence in `schema.sql`), retrieval is Chroma + BM25, and the
token system is JWT access + hashed refresh-token rotation (not the raw-JWT
variant the original Day-1 sketch showed). Adapt as needed.

```bash
# backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-heavy.txt   # optional: full ingestion + semantic retrieval

# services
docker compose up -d postgres mongo redis

# frontend
cd ../frontend && npm install
```

Current repo specifics worth knowing before Day-1 onboarding:
- Backend Python: `backend/requirements.txt` + `backend/requirements-heavy.txt`.
- Services: `docker-compose.yml` (PostgreSQL `pgvector/pgvector:pg16`, MongoDB `mongo:7`,
  Redis `redis:7-alpine`), all with healthchecks.
- `.env` is configured from `.env.example`. Required custom values: `JWT_SECRET`,
  your LLM key (`GEMINI_API_KEY` or `GROQ_API_KEY`), and any SMTP settings.
- MongoDB is best-effort: the app probes at startup with a 1.5 s timeout and
  backs off for 30 s on failure, so MongoDB can be down without taking the API down.
- Redis is best-effort too: when it is unavailable the deny-list and rate limiter
  fall back to in-memory, and the app still starts (important for local dev and
  for cold starts on Render).
- The app seeds on first start via `python -m app.scripts.seed` (idempotent).
- Demo accounts are created **only** when `SEED_DEMO_USERS=true` (development).
  Production ships with `SEED_DEMO_USERS=false` and no built-in accounts; set
  `DEMO_PASSWORD_*` overrides if you enable them locally.

## 6. Starter Code Skeletons

**Settings (`core/config.py`)**

The real config module in this repo is `backend/app/core/config.py` and is
driven by pydantic-settings with an `.env` file. Do not paste the sketch below
into a real project without adapting field names to what your code actually
expects — in this repo the fields are `DATABASE_URL`, `MONGO_URL`, `MONGO_DB`,
`REDIS_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`,
`REFRESH_EXPIRE_DAYS`, `CHROMA_PATH`, `CONFIDENCE_THRESHOLD`, `TOP_K_*`,
`MAX_UPLOAD_MB`, `FRONTEND_URL`, `CORS_ALLOW_ORIGINS`, `CORS_ALLOW_ORIGIN_REGEX`,
`RATE_LIMIT_LOGIN`, `RATE_LIMIT_CHAT`, `LLM_PROVIDER`, `GEMINI_API_KEY`,
`GROQ_API_KEY`, `EMBED_MODEL`, and so on. The `render.yaml` declares most of
them for the deployed backend, with `MONGO_URL` marked `sync: false` (manual entry).

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "dev"
    database_url: str
    mongo_url: str
    mongo_db: str = "substationiq"
    redis_url: str
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    frontend_origin: str
    llm_provider: str = "gemini"
    confidence_threshold: float = 0.35

settings = Settings()
```

**Central errors and envelope (`core/errors.py`)**

The real error handling in this repo is built around FastAPI's standard
HTTPException convention for most endpoints, plus a structured error convention
for the things the sprint wanted to normalize (the TRD's target envelope). The
sketch below is the BUILD_GUIDE.md target; do not assume the running app follows
it uniformly until you grep the routers for the actual shape.

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import structlog
log = structlog.get_logger()

class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400, details=None):
        self.code, self.message, self.status, self.details = code, message, status, details

def envelope_error(request, code, message, status, details=None):
    return JSONResponse(status_code=status, content={
        "success": False,
        "error": {"code": code, "message": message, "details": details},
        "request_id": getattr(request.state, "request_id", None)})

def register_handlers(app):
    @app.exception_handler(AppError)
    async def _app(request: Request, exc: AppError):
        return envelope_error(request, exc.code, exc.message, exc.status, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _val(request: Request, exc: RequestValidationError):
        return envelope_error(request, "VALIDATION_ERROR", "Invalid input", 422,
                              [{"field": ".".join(map(str, e["loc"])), "msg": e["msg"]} for e in exc.errors()])

    @app.exception_handler(Exception)
    async def _any(request: Request, exc: Exception):
        log.error("unhandled", exc_info=exc, request_id=getattr(request.state, "request_id", None))
        return envelope_error(request, "INTERNAL_ERROR", "Something went wrong", 500)
```

**Auth dependencies and RBAC (`core/deps.py`)**

The real auth in this repo is in `backend/app/core/security.py` (`get_current_user`,
`decode_token`, `create_access_token`) and `backend/app/api/auth.py`. The role
vocabulary is `trainee | engineer | admin` (migrated from the legacy
`user | admin`). `require_role` is implemented in the routers that need it (for
example `app/api/diagnosis.py` gates `/api/diagnosis` to ENGINEER+).

The access-token deny-list lives in `backend/app/core/denylist.py`. It is backed
by Redis when Redis is reachable and falls back to in-memory otherwise, so the
app still starts without Redis — and the deny-list survives only until the token
expires (not indefinitely).

```python
from fastapi import Depends
from fastapi.security import HTTPBearer

bearer = HTTPBearer(auto_error=False)

async def get_current_user(cred=Depends(bearer), redis=Depends(get_redis), db=Depends(get_db)):
    if not cred: raise AppError("UNAUTHENTICATED", "Login required", 401)
    payload = decode_access_token(cred.credentials)          # raises AppError on expiry/invalid
    if await redis.exists(f"deny:{payload['jti']}"):         # logged-out token
        raise AppError("UNAUTHENTICATED", "Token revoked", 401)
    user = await UserRepository(db).get(int(payload["sub"]))
    if not user or not user.is_active: raise AppError("UNAUTHENTICATED", "Invalid user", 401)
    return user

def require_role(*roles):
    async def dep(user=Depends(get_current_user)):
        if user.role not in roles:
            raise AppError("FORBIDDEN", "Insufficient permissions", 403)
        return user
    return dep
```

**Ownership pattern**

In the real repo, ownership is enforced in the Mongo repositories
(`backend/app/db/mongo_repos.py`) and in the routers: every conversation/message/
feedback/procedure-run read and write is scoped to `current_user.id`. A user
cannot read, vote on, or complete another user's conversation/procedure run (and
the tests assert the 404 on another user's chat).

```python
async def get_owned_conversation(repo, conv_id, user):
    conv = await repo.get(conv_id, user_id=user.id)   # query always filters by owner
    if not conv: raise AppError("NOT_FOUND", "Conversation not found", 404)
    return conv
```

**Number verifier (`rag/verifier.py`)**

The real repo has a verifier in `backend/app/rag/guardrails.py` (the module that
guardrails the generated answers). If your project also wants a standalone number
verifier like the one below, it belongs near the answer-assembly path and is
cited by the TRD as the guardrail that stops hallucinated limits. The sketch is
kept here as a reference; do not assume the deployed app calls this exact
function by this exact name unless you wire it.

```python
import re
NUM = re.compile(r"(?<![\w.])-?\d+(?:[.,]\d+)?")

def _numbers(text: str) -> set[str]:
    return {n.replace(",", "") for n in NUM.findall(text)}

def unsupported_numbers(answer: str, allowed_texts: list[str]) -> set[str]:
    allowed = set().union(*(_numbers(t) for t in allowed_texts)) if allowed_texts else set()
    cleaned = re.sub(r"\[\d+\]", "", answer)                   # citation markers
    cleaned = re.sub(r"(?m)^\s*\d+[.)]\s", "", cleaned)        # list numbering
    return _numbers(cleaned) - allowed                          # empty set means OK
```

**Result checker (`services/result_check.py`)**

In the real repo the Result Checker is in `backend/app/tools/result_checker.py`,
with the numeric core in `check_numeric_limit` and the request-level wrapper in
`check_result`. Both are deterministic (no LLM arithmetic). The qualitative
branch — a limit with `criterion_text` but no min/max — returns the criterion
text directly as a "see criterion" result rather than attempting a numeric
comparison.

Verified here: `check_numeric_limit(100, 50, 200)` → "within limits",
`check_numeric_limit(30, 50, 200)` → "outside limits",
`check_numeric_limit(48, 50, 200)` → "outside limits".

```python
def check(value: float, lo: float | None, hi: float | None, margin_pct: float = 5.0) -> str:
    if (lo is not None and value < lo) or (hi is not None and value > hi):
        return "outside"
    edges = [x for x in (lo, hi) if x is not None]
    for e in edges:
        if e != 0 and abs(value - e) / abs(e) * 100 <= margin_pct:
            return "borderline"
    return "within"
```

**SSE chat endpoint shape**

The real repo already has a streaming chat endpoint over SSE. The sketch below
is the canonical shape to copy; in this repo the actual event types and service
live in `backend/app/api/chat.py` and the related service/tooling modules.

```python
from fastapi.responses import StreamingResponse
@router.post("/chat/stream")
async def chat_stream(body: ChatIn, user=Depends(get_current_user), svc=Depends(get_chat_service)):
    async def gen():
        async for event in svc.answer(body, user):           # yields dicts: intent/token/citations/safety/done
            yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")
```

## 7. `docker-compose.yml` and `.env.example`

Both files are in the repo. The included `docker-compose.yml` already defines
PostgreSQL (`pgvector/pgvector:pg16`), MongoDB (`mongo:7`), and Redis
(`redis:7-alpine`) with healthchecks, plus `backend`, `worker`, and `frontend`
services. The included `.env.example` lists every env var the app reads. Copy
`.env.example` to `.env`, set `JWT_SECRET`, your LLM key, and any SMTP settings,
then run `docker compose up --build`.

Note: the built `docker-compose.yml` in this repo uses `DATABASE_URL` pointing at
the local Postgres service even though the running app defaults to SQLite. That
is fine as evidence of the intended production stack; in local dev you can either
bring Postgres up or just run the app against SQLite (the default).

Also note: if you copy this repo as a starting skeleton, the two
dashboard-only env vars that are **not** in the repo files are the ones that make
the deployed app work end to end: `VITE_API_URL` on Vercel (the live backend
URL) and `MONGO_URL` on Render (the MongoDB connection string, declared
`sync: false` so Render never auto-fills it). Set them in the dashboards, not in
a file you commit.

## 8. Testing Checklist

This checklist is the originating spec. Against the actual repo, everything in
the backend block below is **already covered by the backend test suite** except
the Playwright/E2E row and the load-test row (if you still want them).

The backend test suite lives in `backend/tests/` (`test_api.py`,
`test_mongo.py`, `test_migrate.py`, `test_nlp.py`, plus `conftest.py` and
`mongo_fakes.py`). Local run (from `backend/`):

```bash
cd backend
pytest -q            # default invocation
pytest --cov=app    # with coverage if you want it
```

What is already tested (backend):
- Auth: register, login, wrong password, refresh rotation, logout revokes access-token `jti`, expired token handling.
- RBAC: role gating (403 on wrong role), ownership (another user's chat returns 404), admin-only analytics.
- Validation: bad bodies / bad query params return sensible error shapes.
- Catalog CRUD with pagination, filtering and sorting is implemented; the shared `ListingParams` dependency is in `app/api/deps.py`.
- Chat: SSE endpoint exists and persists to Mongo; the "not found" path exists.
- Result Checker: numeric (`within` / `borderline` / `outside`) and qualitative (`criterion_text`) branches are implemented and verified.
- DGA: fault-diagnosis logic is implemented and writes `fault_logs`.
- Rate limit: slowapi is wired on `/auth/login` (5/min) and `/chat/stream` (30/min) in production; it is relaxed in tests.
- Mongo repositories: `backend/tests/test_mongo.py` covers the new Mongo repos.

Still open (frontend / full system):
- [ ] Playwright / E2E: login → ask → open citation → start procedure (the spec calls for at least one happy path).
- [ ] Load test: if you want it as evidence.
- [ ] Fresh-clone smoke test: `docker compose up` from a clean checkout (Day-15 item).

## 9. Deployment Checklist

This is the originating spec. The deployment configs already in the repo are:
`docker-compose.yml` (local), `render.yaml` (Render backend with an attached
managed Postgres + managed Redis, plus a disk mount for Chroma), `vercel.json`
(frontend), and Dockerfiles for both backend and frontend.

What is already wired:
- Managed Postgres with pgvector: the Render backend is wired to an attached
  managed Postgres via `render.yaml` (`DATABASE_URL` from the attached database).
- MongoDB: the `render.yaml` declares `MONGO_URL` as `sync: false`, so Render
  will **not** auto-fill it. You must paste your MongoDB connection string (Atlas
  free tier or an equivalent) into the Render dashboard for the backend service.
- Redis: the Render backend is wired to an attached managed Redis via
  `render.yaml`.
- Backend + worker: two services from the same image, both declared in
  `docker-compose.yml`; the Render setup follows the same pattern.
- Frontend on Vercel with `VITE_API_URL`: `vercel.json` is in place and the
  `.vercel/` project exists, but the environment variable is **not** set on the
  Vercel project yet. Set `VITE_API_URL` to your live backend URL (for example
  `https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com`).
- HTTPS, CORS, env-based config: `render.yaml` sets `FRONTEND_URL` and
  `CORS_ALLOW_ORIGINS` to the deployed frontend origin, and declares
  `CORS_ALLOW_ORIGIN_REGEX` for `*.vercel.app` preview URLs. The security
  middleware also adds HSTS once the origin is not localhost.

Remaining manual dashboard steps (the only things between "code is done" and
"both services work live"):
1. **Vercel** → Environment Variables → add `VITE_API_URL` =
   `https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com` (your live
   backend URL).
2. **Render** → backend service → Environment → set `MONGO_URL` to your MongoDB
   connection string. Everything else Render auto-wires from the attached
   services or the defaults in `render.yaml`.

Then re-deploy/restart and smoke-test the backend (see `scripts/smoke.sh`):

```bash
curl -s https://<your-render-service>.onrender.com/health
```

Expected: `{"status":"healthy",...}`. Register an account through the app (or
`POST /api/auth/register`) instead of using built-in credentials — none exist
in production.

Other rows from the originating spec still apply as goals:
- [ ] Smoke test: register, ask, upload as admin, run a procedure (against the deployed link).
- [ ] Keep a local Docker Compose fallback for the viva in case of network issues.

## 10. Demo Script (3 to 5 minutes)

This demo script is still the right shape. Use the real URLs, the real demo
accounts, and the real Result Checker / DGA flows. The demo is the moment where
you prove the app works end to end, so have it running before the viva and keep a
local Docker Compose fallback in case of network issues.

Accounts: register fresh accounts before the demo (the deployment seeds no
demo users; do not publish credentials in slides or docs).

Script:
1. Login as trainee: ask "How do I do an insulation resistance test on a power transformer?" → structured answer, open a citation.
2. Ask with a synonym and a typo ("megger test on CT") → correct intent and entity.
3. Ask something unsupported → honest "not found".
4. Start a guided procedure; show the safety gate; export the PDF.
5. Result checker with an outside-limit value → troubleshooting actions
   (demonstrate the numeric `outside` result; optionally show a qualitative
   `criterion_text`-only limit returning "see criterion").
6. Login as engineer: DGA triangle / fault diagnosis; draft or inspect a catalog entry.
7. Login as admin: verify the entry, show analytics and the evaluation ablation table.
8. Show the ER diagram, a Mongo document, and the commit graph / CI status.

Open-source note if relevant: if you are presenting this as a public or reusable
artifact, keep the demo accounts as seeded test accounts only and do not rely on
them as the only auth path.

## 11. Final Week Checklist

This is the originating checklist. Against the actual repo, most backend P0 work
is done; what remains is the docs/polish/deployment tail and the two manual
dashboard steps. Use this as the Day-14/15 to-do list.

- [ ] All P0 features stable on the deployed link (auth, chat, catalog, procedures,
      Result Checker, DGA, admin analytics — all implemented; the deployed link is
      the remaining gate).
- [ ] `RUBRIC_CHECKLIST.md` fully ticked with evidence links
      (`RUBRIC_CHECKLIST.md` exists and is mostly unchecked — fill the Evidence
      columns with commits/files/screenshots).
- [ ] Report, evaluation report, ER diagram, DDL, queries, Mongo notes submitted
      (`docs/DB.md`, `schema.sql`, `docs/openapi.json` already exist; the ER
      diagram image is the optional artifact if the report wants one).
- [ ] README screenshots and demo video linked
- [ ] Each teammate has explained every layer to the others at least once
      (the TRD cross-training session is the viva-prep mechanism for this).
- [ ] Fresh-clone test: `docker compose up` works from scratch
- [ ] Evaluation re-run and metrics updated (`eval/run_eval.py` exists and is
      runnable; re-run it against the finalized app and update the metrics table
      and the cache-latency note).
- [ ] Cleanup of stale scratch files so the repo's tracked tree matches the real
      project shape (this repo currently has archive/copies of older drafts and a
      couple of scratch artifacts in the root that should be removed or ignored
      before the final tag).

Remaining non-code items to complete before the final tag:
- Set `VITE_API_URL` on Vercel (manual dashboard step).
- Set `MONGO_URL` on Render (manual dashboard step).
- Demo video and final fresh-clone smoke test.
