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
