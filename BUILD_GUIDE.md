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

| | **A: Intelligence** | **B: Backend & Data** | **C: Frontend & Product** |
|---|---|---|---|
| Core | NLP, retrieval, LLM, guardrails, verifier, evaluation | FastAPI layers, auth/RBAC, Postgres + Mongo, Alembic, Redis, ARQ, security, CI/CD, deploy | React app, all screens, SSE client, PDF export, E2E test, demo video |
| Catalog | Transformer + Reactor | Circuit Breaker | Instrument Transformer + Surge Arrester |
| Docs | Evaluation report | DB.md, ER diagram, API docs | DESIGN.md, README, user guide |

**Daily rhythm**
- Everyone pushes at least one meaningful commit **every day** (a small vertical slice, test, doc, catalog entry, or fix all count).
- Two 15-minute syncs a week; one 45-minute **cross-training** session weekly where each person walks the others through their code (this is your viva preparation).
- Review each other's PRs within 24 hours.
- Never push a large block of work at the end; the ISD rubric gives 5 marks purely for consistent history.

## 3. Eight-Week Plan

| Week | A: Intelligence | B: Backend & Data | C: Frontend & Product |
|---|---|---|---|
| **1** | Collect sources; define 40+ test list; catalog YAML format | Repo, Docker Compose, config, Postgres schema + Alembic, Mongo connection, health endpoint, CI | Vite app, routing, design tokens, login/register screens |
| **2** | Catalog: first 20 tests; `validate_catalog.py`; embeddings model set up | Auth (register, login, refresh, logout), users table, RBAC deps, error handler, response envelope | App shell, auth flow, catalog list and detail pages |
| **3** | Ingestion pipeline (parse, chunk, embed); hybrid retrieval SQL; synonyms table | Catalog CRUD endpoints with pagination/filter/sort; ARQ worker; document upload endpoint | Chat UI with SSE streaming (mock first), equipment chips |
| **4** | Query understanding: normalise, entities, intent; LLM provider wrapper | `/chat/stream` service, conversations/messages in Mongo, Redis cache | Structured answer card, citation panel, history |
| **5** | Answer assembler, guardrails, verifier, "not found" logic | Rate limiting, security headers, procedure-runs API, feedback API | Guided procedure UI, feedback UI, admin documents page |
| **6** | Finish catalog to 40+ tests; fault diagnosis service | Analytics endpoints, verification workflow, email (reset), scheduled jobs | Result checker UI, catalog editor, verification queue |
| **7** | DGA logic + tests; evaluation set, runs, ablations | Quiz service, tests to 70% on services, logging polish, load test | Learn mode UI, DGA triangle plot, analytics and eval pages |
| **8** | Evaluation report; final tuning | Deployment, seed data, backups, docs/OpenAPI export | E2E test, mobile polish, demo video, README screenshots |

## 4. Getting the Catalog Data (Most Important Content Task)

1. Build the test list per equipment class first (names only), for example transformer: insulation resistance and polarisation index, winding resistance, turns ratio, tan delta and capacitance, DGA, oil breakdown voltage, oil moisture, SFRA, OLTC checks; similarly for the other classes.
2. For each test, collect **from real sources** (OEM manuals, public standards summaries, utility maintenance guides, CEA/CBIP public material, open-access papers): purpose, instruments, safety points, procedure steps, limits with conditions, standards, common issues and actions.
3. Record the **source** (document, page, section) alongside every limit and standard as you enter it.
4. Run `validate_catalog.py` in CI: fails if any limit has no source, any test lacks steps or safety notes, or any unit is missing.
5. Ask an electrical-department faculty member or a lab instructor to spot-check a sample. Mention this review in the report.
6. Never fill limits from memory or from an LLM. Mark uncertain entries `draft`; only verified entries power answers.

## 5. Day-1 Setup (copy and adapt)

```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic pydantic-settings \
  motor redis arq slowapi pyjwt argon2-cffi python-multipart aiosmtplib structlog \
  sentence-transformers spaCy rapidfuzz pymupdf pdfplumber python-docx pytesseract \
  pgvector httpx pytest pytest-asyncio pytest-cov ruff
pip freeze > requirements.txt

# services
docker compose up -d postgres mongo redis
alembic init app/db/migrations

# frontend
cd ../frontend && npm create vite@latest . -- --template react-ts
npm i react-router-dom @tanstack/react-query recharts lucide-react
npm i -D tailwindcss postcss autoprefixer vitest @playwright/test
```

## 6. Starter Code Skeletons

**Settings (`core/config.py`)**
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

**Ownership pattern (services/conversations.py)**
```python
async def get_owned_conversation(repo, conv_id, user):
    conv = await repo.get(conv_id, user_id=user.id)   # query always filters by owner
    if not conv: raise AppError("NOT_FOUND", "Conversation not found", 404)
    return conv
```

**Number verifier (`rag/verifier.py`)**
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
Both files are included at the project root. Copy `.env.example` to `.env`, set `JWT_SECRET`, your Gemini key and the SMTP settings, then run `docker compose up --build`.

## 8. Testing Checklist

- [ ] Auth: register, login, wrong password, refresh rotation, logout revokes, expired token
- [ ] RBAC: each role against each protected endpoint; ownership (another user's chat returns 404)
- [ ] Validation: bad bodies, bad query params, oversize/invalid uploads
- [ ] Catalog CRUD with pagination, filter and sort
- [ ] Chat: each intent returns the right sections; unknown question returns "not found"; bypass request refused
- [ ] Verifier rejects an answer with an unsupported number
- [ ] Result checker and DGA against known examples
- [ ] Rate limit returns 429
- [ ] Playwright: login → ask → open citation → start procedure

## 9. Deployment Checklist

1. Managed Postgres with pgvector; run `alembic upgrade head`; run `seed`.
2. MongoDB Atlas free cluster; IP allow-list or VPC.
3. Redis instance.
4. Backend and worker as two services from the same image; set all env vars.
5. Frontend on Vercel with `VITE_API_URL`.
6. HTTPS on, CORS set to the frontend origin, `APP_ENV=prod`.
7. Smoke test: register, ask, upload as admin, run a procedure.
8. Keep a local Docker Compose fallback for the viva in case of network issues.

## 10. Demo Script (3 to 5 minutes)

1. Login as trainee: ask "How do I do an insulation resistance test on a power transformer?" → structured answer, open a citation.
2. Ask with a synonym and a typo ("megger test on CT") → correct intent and entity.
3. Ask something unsupported → honest "not found".
4. Start a guided procedure; show the safety gate; export the PDF.
5. Result checker with an outside-limit value → troubleshooting actions.
6. Login as engineer: DGA triangle; draft a catalog entry.
7. Login as admin: verify the entry, show analytics and the evaluation ablation table.
8. Show the ER diagram and a Mongo document, then the CI badge and the commit graph.

## 11. Final Week Checklist

- [ ] All P0 features stable on the deployed link
- [ ] `RUBRIC_CHECKLIST.md` fully ticked with evidence links
- [ ] Report, evaluation report, ER diagram, DDL, queries, Mongo notes submitted
- [ ] README screenshots and demo video linked
- [ ] Each teammate has explained every layer to the others at least once
- [ ] Fresh-clone test: `docker compose up` works from scratch
