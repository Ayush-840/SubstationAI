# TRD — SubstationIQ, 15-Day Capstone Compliance Sprint

Version 4.0 — **supersedes v3.0.** v3.0 planned a from-scratch Postgres+Mongo+Redis stack. The actual repo ([Ayush-840/SubstationAI](https://github.com/Ayush-840/SubstationAI)) already runs FastAPI + SQLAlchemy + **SQLite**, **Chroma**+BM25 hybrid retrieval, NLP intent/entity detection, a 5-class test catalog, guided procedures, fault diagnosis with DGA rules, two roles, and a 30-case eval harness with 34 backend tests. This TRD only specifies the **delta**: what's added over 15 days, by whom, each day, to close the gaps in PRD.md §2.

---

## 1. Architecture Delta

```
BEFORE (current repo)                 AFTER (end of sprint)
React (Vite) → FastAPI → SQLite       React (Vite) → FastAPI /api/v1 → SQLite (catalog, users)
                → Chroma + BM25                        → MongoDB (conversations, messages,
                → Gemini/Groq/Ollama                      feedback, fault_logs)
                                                        → Redis (cache, rate limit, token deny-list)
                                                        → Chroma + BM25 (unchanged)
                                                        → Gemini/Groq/Ollama (unchanged)
```

**Not touched:** retrieval pipeline (Chroma, BM25, reranking), NLP intent/entity layer, catalog schema and content, guided procedures, DGA logic, evaluation harness structure. These already work and are not in scope for this sprint.

**Added:** MongoDB (new, closes the DBMS NoSQL rubric gap), Redis (new, third advanced capability + backs rate limiting and the token deny-list), Engineer role, refresh-token rotation, API envelope/pagination/versioning, rate limiting, Result Checker feature, deployment, and the DB.md evidence pack.

## 2. Day-by-Day Plan (15 days, 3 members)

Member key: **A — Data & Backend** (owns SQL evidence, Mongo, auth/RBAC) · **B — API & Platform** (owns API conventions, security, Redis, deployment) · **C — Product & Frontend** (owns Result Checker UI, history UI, docs).

Dates assume a start of **Tue 13 Oct 2026**; shift the whole table if the sprint starts later. Weekend days are intentionally lighter (docs, tests, fixes) so the commit streak never breaks — commit tracking does not allow backdating, so a skipped day cannot be recovered later.

### Day 1 — Tue 13 Oct: Kickoff and evidence-pack skeleton
| Who | Task | Commit message |
|---|---|---|
| A | Draw the ER diagram from the existing SQLAlchemy models (dbdiagram.io or draw.io); start `docs/DB.md` with a data-dictionary table | `docs: add ER diagram and data dictionary skeleton` |
| B | Add `/api/v1` router prefix; central error envelope (`core/errors.py`) wrapping existing exceptions without changing endpoint logic | `feat(api): v1 prefix and central error envelope` |
| C | Write the Result Checker API contract (Pydantic request/response) and a UI wireframe | `docs: Result Checker API contract and wireframe` |

### Day 2 — Wed 14 Oct: SQL evidence + Mongo scaffolding
| Who | Task | Commit message |
|---|---|---|
| A | Collect 5+ real queries the app already runs into `docs/DB.md` §Queries (a join across catalog tables, a GROUP BY/HAVING, a subquery or CTE); add a MongoDB service to `docker-compose.yml`, `motor` dependency, `db/mongo.py` connection module | `feat(db): MongoDB service and async connection module` |
| B | Shared pagination/filtering/sorting dependency; apply to `GET /catalog/tests` | `feat(api): pagination, filtering, sorting on catalog list` |
| C | Scaffold the Result Checker page (form only) with existing design tokens | `feat(frontend): Result Checker form scaffold` |

### Day 3 — Thu 15 Oct: Mongo — conversations and messages
| Who | Task | Commit message |
|---|---|---|
| A | `conversations`/`messages` Mongo collections (Motor + Pydantic); repository class (insert/find/update/delete) | `feat(db): Mongo repositories for conversations and messages` |
| B | Wire `/chat/stream` to also persist to Mongo (additive — SQLite/Chroma behavior unchanged) | `feat(chat): persist conversations/messages to MongoDB` |
| C | Conversation-history UI reading from the Mongo-backed endpoint | `feat(frontend): history view reads from MongoDB` |

### Day 4 — Fri 16 Oct: Mongo — feedback and fault logs
| Who | Task | Commit message |
|---|---|---|
| A | `feedback` and `fault_logs` collections + repositories; move fault-diagnosis storage to Mongo | `feat(db): feedback and fault_logs collections` |
| B | `POST /messages/{id}/feedback` backed by Mongo; guard `ObjectId` conversion at the repository boundary | `feat(api): feedback endpoint backed by MongoDB` |
| C | Thumbs up/down widget wired to feedback; fault-diagnosis screen shows history from `fault_logs` | `feat(frontend): feedback widget and fault-log history` |

### Day 5 — Sat 17 Oct (light): Mongo docs + regression check
| Who | Task | Commit message |
|---|---|---|
| A | `docs/DB.md` §MongoDB: collection shapes, embed-vs-reference justification per relationship, sample documents, one `$lookup` aggregation example (feedback→messages, with the ObjectId type-match note) | `docs: MongoDB design rationale and sample documents` |
| B | Run the existing 34-test suite; add 5 tests for the new Mongo repositories; fix any regressions | `test: Mongo repository tests, confirm suite green` |
| C | Loading/empty/error states for history and feedback UI; dry-run the chat→Mongo flow | `fix(frontend): loading/empty states for history/feedback` |

### Day 6 — Sun 18 Oct (light): Auth hardening
| Who | Task | Commit message |
|---|---|---|
| A | Refresh-token storage (hashed, rotated on use) + `/auth/refresh` | `feat(auth): refresh-token rotation` |
| B | `/auth/logout` revokes the refresh token and deny-lists the access-token `jti` (in-memory for now, moves to Redis Day 9) | `feat(auth): logout revocation` |
| C | README stack section updated (SQLite + Mongo); Result Checker contract refined from what Days 1–5 revealed | `docs: README stack update` |

### Day 7 — Mon 19 Oct: RBAC — three roles
| Who | Task | Commit message |
|---|---|---|
| A | Add `Engineer` role to the user model; migration; reseed (existing non-admin users → Trainee, add one Engineer demo user) | `feat(auth): add Engineer role, migrate seed data` |
| B | `require_role` on fault-diagnosis and DGA endpoints (Engineer+); ownership check on conversation/feedback/procedure-run endpoints | `feat(authz): role gating + ownership checks` |
| C | Role-aware navigation (hide Engineer-only tools for Trainees); show role after login | `feat(frontend): role-aware navigation` |

### Day 8 — Tue 20 Oct: Security + Result Checker backend
| Who | Task | Commit message |
|---|---|---|
| A | Result Checker comparison service against `test_limits` (within/borderline/outside); branch for qualitative-only limits (`criterion_text` set, no min/max) | `feat(tools): Result Checker comparison service` |
| B | Rate limiting (slowapi) on `/auth/login` and `/chat/stream`; CORS allow-list tightened; security headers middleware | `feat(security): rate limiting, CORS, security headers` |
| C | `POST /tools/check-result` endpoint; UI wired end-to-end | `feat(frontend): Result Checker wired end-to-end` |

### Day 9 — Wed 21 Oct: Redis — third advanced capability
| Who | Task | Commit message |
|---|---|---|
| A | Redis service in `docker-compose.yml`; cache helper for catalog reads and repeated-answer lookups, keyed by normalized query + equipment | `feat(cache): Redis caching for catalog and chat answers` |
| B | Move Day-6 in-memory deny-list and the rate limiter's state to Redis | `refactor(auth): deny-list and rate limiter on Redis` |
| C | Advanced-capabilities table updated in `docs/TRD.md` (SSE + LLM + Redis, each tied to a real need) | `docs: advanced capabilities table` |

### Day 10 — Thu 22 Oct: Testing sweep
| Who | Task | Commit message |
|---|---|---|
| A | Tests: refresh rotation, role gating (403 on wrong role), ownership (404 on another user's chat) | `test: auth, RBAC and ownership coverage` |
| B | Tests: rate limiting (429 on burst), cache hit/miss | `test: rate limit and cache tests` |
| C | Tests: Result Checker (numeric + qualitative branches); one Playwright happy path (login → ask → open citation → check result) | `test: Result Checker tests + E2E happy path` |

### Day 11 — Fri 23 Oct: Documentation push
| Who | Task | Commit message |
|---|---|---|
| A | Finalize `docs/DB.md` (ER diagram image, full data dictionary, final query list with one-line explanations); export OpenAPI JSON | `docs: finalize DB.md, export OpenAPI spec` |
| B | Update the architecture diagram in `docs/TRD.md` to the real stack (this section) | `docs: architecture diagram matches actual stack` |
| C | README overhaul (features, roles, Result Checker, roadmap checkboxes, screenshot placeholders) | `docs: README overhaul for sprint features` |

### Day 12 — Sat 24 Oct (light): Deployment
| Who | Task | Commit message |
|---|---|---|
| A + B | Deploy backend to Render/Railway; MongoDB Atlas free tier; managed Redis; set env vars; smoke test | `chore(deploy): backend, MongoDB, Redis deployed` |
| C | Deploy frontend to Vercel; point `VITE_API_URL` at the backend; verify CORS from the deployed origin | `chore(deploy): frontend deployed, CORS verified` |

### Day 13 — Sun 25 Oct (light): Evaluation refresh
| Who | Task | Commit message |
|---|---|---|
| A | Re-run `eval/run_eval.py` and `--ablation` against the updated app; update the metrics table; add a latency note on cache impact | `docs: refreshed evaluation results post-sprint` |
| B + C | Bug-fix day: triage anything found on Day 10 (tests) or Day 12 (deployment smoke test) | `fix: post-deployment bug fixes` |

### Day 14 — Mon 26 Oct: RUBRIC_CHECKLIST and viva prep
| Who | Task | Commit message |
|---|---|---|
| All 3 | Fill `docs/RUBRIC_CHECKLIST.md` with evidence links (commits, files, screenshots) for every ISD/ASD/DBMS row; each member writes 3–4 viva answers for their own area | `docs: RUBRIC_CHECKLIST evidence and viva prep` |

### Day 15 — Tue 27 Oct: Final polish and demo
| Who | Task | Commit message |
|---|---|---|
| All 3 | Fresh-clone test (`docker compose up` from a clean checkout); fix anything broken; record the demo video; tag the release | `chore: final polish, demo video, tag v1.0-capstone` |

## 3. New Components — Technical Notes

### 3.1 MongoDB collections (new)
| Collection | Shape | Embed or reference |
|---|---|---|
| `conversations` | `{_id, user_id, title, mode, equipment, created_at, updated_at}` | Header only; messages stored separately for paged reads |
| `messages` | `{_id, conversation_id, role, content, intent, entities, citations:[], confidence, created_at}` | `citations[]` embedded — always read with the message, never queried alone |
| `feedback` | `{_id, message_id, user_id, rating, comment, created_at}` | References `message_id` as an **ObjectId** — see the type-match caution below |
| `fault_logs` | `{_id, user_id, equipment_class, symptoms:[], readings:{}, diagnosis, resolution, logged_at}` | Readings vary by equipment, which suits a flexible document better than fixed SQL columns |

**ObjectId caution (Day 4/5):** `$lookup` matches on exact BSON type. If `feedback.message_id` is ever inserted as a plain string (easy mistake if it arrives as a path parameter), the join silently returns nothing — no error, just `null` aggregates. Convert with `ObjectId(message_id)` at the repository boundary before every write.

### 3.2 Role model change (Day 7)
`user.role` becomes an enum of `trainee | engineer | admin` (was `user | admin`). Migration: existing `user` rows → `trainee`; existing `admin` rows unchanged; seed one `engineer` demo account. `require_role("engineer", "admin")` gates `/tools/diagnosis` and `/tools/dga`. Ownership checks (`user_id` filter on every read/update/delete of a conversation, message, feedback row, or procedure run) apply to all three roles equally.

### 3.3 Result Checker (Day 8)
Deterministic comparison, no LLM arithmetic:
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
A test's limit may be purely qualitative (`criterion_text` set, no `min_value`/`max_value`) — e.g. "no visible tracking on the surface." Those return the criterion text directly as a "see criterion" result rather than attempting a numeric comparison.

### 3.4 Advanced capabilities (ASD #8, Day 9)
| Capability | Need it solves |
|---|---|
| Real-time streaming (SSE) — existing | Answers appear token by token |
| Third-party integration (LLM) — existing | Natural-language answers |
| **Redis caching — new** | Repeated catalog reads and repeated questions return instantly and save LLM quota; also backs the Day-6 token deny-list and the Day-8 rate limiter so both survive multiple backend workers |

### 3.5 API conventions (Day 1–2)
- Base path `/api/v1`; existing routes keep working at their old paths during the sprint (don't break the eval harness mid-sprint) and are moved under the prefix once Day 10's tests pass.
- Envelope: `{"success": true, "data": ..., "meta": {"page", "page_size", "total"}}` for lists; `{"success": false, "error": {"code","message","details"}}` for errors.
- Pagination/filtering/sorting query params: `?page=&page_size=&sort=&equipment=&q=`.

### 3.6 Security (Day 8–9)
- `slowapi` + Redis backend: `RATE_LIMIT_LOGIN=5/minute`, `RATE_LIMIT_CHAT=30/minute`.
- CORS: allow-list the deployed frontend origin only (no wildcard).
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` (once HTTPS is live post-Day-12).
- **Exempt the eval harness** from rate limiting (service-account bypass or an env-var-raised limit in CI) so Day 13's 30-case run doesn't trip 429s.

## 4. Config Additions

`.env` additions this sprint:
```
MONGO_URL=mongodb://mongo:27017
MONGO_DB=substationiq
REDIS_URL=redis://redis:6379/0
REFRESH_TOKEN_DAYS=7
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_CHAT=30/minute
```
`docker-compose.yml` additions: `mongo` (image `mongo:7`) and `redis` (image `redis:7-alpine`) services, both with healthchecks, wired as `depends_on` for `backend`.

## 5. Definition of Done for the Sprint

- All 15 days show commits from all 3 members on the portal (no backdating needed because none is skipped).
- `docs/DB.md` complete: ER diagram, data dictionary, 5+ real queries, Mongo collection notes with sample documents.
- Three roles enforced and tested; ownership checks tested.
- `/api/v1` envelope, pagination/filtering/sorting live on catalog and conversation-list endpoints.
- Rate limiting, CORS allow-list, security headers in place.
- Redis cache measurably reduces repeat-query latency (captured in the refreshed eval report).
- Result Checker live end-to-end, numeric and qualitative branches both tested.
- App deployed at a public URL; existing 34+new tests green; eval harness re-run and documented.
- `docs/RUBRIC_CHECKLIST.md` fully filled with evidence links.

---

## 6. Execution Status (as of the latest commit on `main`)

This section is the running record of what the sprint actually delivered,
against the plan above. Date shift: the repo's first commit is 2026-09-24 and
the latest is 2026-10-24, so the calendar days below are **indicative only** —
use the commit log (`git log --oneline`) as the real day-by-day record.

Legend: **DONE** = implemented and in the repo / deployed. **TODO** = still
required (often a manual dashboard step, not a code gap). **N/A** = the plan
assumed something the repo does differently.

### Architecture delta — status
- MongoDB added and wired: **DONE** (`docker-compose.yml`, `app/db/mongo.py`,
  `app/db/mongo_repos.py`, `app/main.py` lifespan).
- Redis added and wired: **DONE** (`docker-compose.yml`, `app/cache/redis_cache.py`,
  deny-list uses Redis when available, rate limiter uses Redis when available).
- Engineer role: **DONE** (seed + migration + `require_role` gate on `/api/diagnosis`).
- Refresh-token rotation + logout deny-list: **DONE** (`app/api/auth.py`,
  `app/core/refresh.py`, `app/core/denylist.py`). Note: the logout endpoint is
  `async def` and `await`s the deny-list revoke — a prior sync version of this
  file called the async revoke without `await` and silently never wrote the JTI;
  that was fixed on the main branch.
- `/api/v1` prefix: **DONE** (`app/api/v1/__init__.py` mounts all routers under
  `/api/v1` alongside the legacy `/api/...` routes).
- Pagination/filtering/sorting: **DONE** (`app/api/deps.py` `ListingParams` applied
  on `GET /api/v1/tests` and legacy `/api/catalog/tests`).
- Envelope convention: **N/A in full** — list endpoints currently return data
  directly; the TRD's `{"success":..., "data":...}` envelope is the target
  convention, not yet universal. Do not cite a blanket envelope rule that the
  code does not yet follow.
- Rate limiting + CORS + security headers: **DONE** (`app/core/security_middleware.py`).
  CORS now uses an exact allow-list **plus** an optional origin regex so any
  `*.vercel.app` preview URL is allowed without hardcoding the exact subdomain.
- Result Checker: **DONE** (`app/tools/result_checker.py`, `POST /api/diagnosis/check-result`
  and `POST /api/diagnosis/tools/check-result`).

### Day-by-day status
| Day | Status | Evidence |
|---|---|---|
| 1 | **DONE** | `docs/DB.md` (rewritten to match the real stack), `docs/openapi.json` exported, `/api/v1` router exists, Result Checker contract in `app/schemas/__init__.py` (`CheckResultRequest/Response`) |
| 2 | **DONE** | `ListingParams` in `app/api/deps.py`; `GET /api/catalog/tests` paginates/filters/sorts; MongoDB service + `motor` in `docker-compose.yml` + `requirements.txt`; `app/db/mongo.py` connection module |
| 3 | **DONE** | `app/db/mongo_repos.py` (`ConversationRepo`, `MessageRepo`); `/chat/stream` and `POST /api/chat` persist to Mongo; history UI page exists at `frontend/src/pages/History.tsx` |
| 4 | **DONE** | `feedback` and `fault_logs` collections + repos; `POST /messages/{id}/feedback` Mongo-backed with SQL mirror; fault-diagnosis writes `fault_logs` (Mongo system of record) |
| 5 | **DONE** | `docs/DB.md` §MongoDB complete (shapes, embed-vs-reference, sample docs, `$lookup` example, ObjectId note); mongo test suite in `backend/tests/test_mongo.py`; existing suite + mongo tests green |
| 6 | **DONE** | refresh rotation + `/auth/refresh`; `/auth/logout` revokes refresh token and deny-lists access `jti`; README stack section updated (SQLite + Mongo) |
| 7 | **DONE** | `Engineer` role in model + migration + seed; `require_role` on `/api/diagnosis`; ownership checks on conversation/feedback/procedure-run; tests for 403 on wrong role + 404 on another user's chat |
| 8 | **DONE** | `app/tools/result_checker.py` (within/borderline/outside + qualitative "see criterion"); rate limiting on `/auth/login` and `/chat/stream`; CORS allow-list + regex; security headers; `POST /tools/check-result` |
| 9 | **DONE** | Redis in `docker-compose.yml`; cache helper in `app/cache/redis_cache.py`; deny-list and rate limiter use Redis when available (fall back to in-memory otherwise) |
| 10 | **DONE** | auth/RBAC/ownership/rate-limit/Result-Checker tests present in `backend/tests/test_api.py` and `backend/tests/test_mongo.py`; full suite green (106 passed in the latest local run) |
| 11 | **DONE** | `docs/DB.md` finalized (this sprint's rewrite); OpenAPI JSON at `docs/openapi.json`; README overhaul done |
| 12 | **DONE (code)** / **TODO (manual)** | Backend Dockerfile + `render.yaml` + `docker-compose.yml` + `vercel.json` in place; frontend `.vercel/` project exists. **Two manual env-var steps remain** (see below). |
| 13 | **PARTIAL** | `eval/run_eval.py` exists and is runnable; re-run + metrics update + cache-latency note still to do; bug-fix day is ongoing (the `redis` import crash found during deployment smoke test was fixed and pushed) |
| 14 | **PARTIAL** | `RUBRIC_CHECKLIST.md` exists (118 lines) but Evidence columns are mostly unchecked — fill with the links below |
| 15 | **TODO** | Fresh-clone smoke test, demo video, tag — not yet done |

### Day 12 manual steps (the only non-code items left)
These are dashboard actions, not code changes. The configs are already in the
repo; the values just need to be entered where the platform reads them.

1. **Vercel — set `VITE_API_URL`.** In the Vercel project settings → Environment
   Variables, add `VITE_API_URL` = `https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com`
   (the live Render backend URL). Without it the frontend's API client has no
   base URL and login/chat fail in production. (`frontend/.env.local` is empty
   today; Vercel reads its own env-var settings, not `.env.local`.)
2. **Render — set `MONGO_URL`.** In the Render dashboard for the backend service,
   set `MONGO_URL` to the MongoDB connection string (Atlas free tier or Render
   MongoDB). The `render.yaml` declares it as `sync: false`, so Render will not
   auto-fill it — paste the connection string explicitly. Everything else
   (`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `FRONTEND_URL`, `CORS_*`, `CHROMA_PATH`)
   is declared in `render.yaml` and is either auto-wired from attached services or
   set to a working default.

After both are set, re-deploy/restart the services and smoke-test:
`curl -X POST https://backend-h8ikkpyfy-ayush-840s-projects.onrender.com/api/auth/login
-H "Content-Type: application/json" -d '{"email":"demo@substationiq.dev","password":"demo1234"}'`
should return an `access_token`.

### Known discrepancies between this TRD and the real repo (do not cite the TRD uncritically)
- The TRD says roles were `user | admin` before Day 7. The real repo migrated from
  `user|admin` to `trainee|engineer|admin` — same idea, different names.
- The TRD lists `quiz_attempts` and `audit_events` as live Mongo collections. In
  this repo, quiz results are stored in SQLite (`quiz_attempts` table), not Mongo.
- The TRD's Day 9 says "move the deny-list to Redis." The real code does this
  conditionally: Redis when available, in-memory otherwise — so the app starts
  even without Redis (important for local dev and for the Render cold-start case).
- The TRD's envelope convention (§3.5) is the target, not yet universal; legacy
  paths return data directly.
