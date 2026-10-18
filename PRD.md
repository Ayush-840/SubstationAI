# PRD — SubstationIQ, 15-Day Capstone Compliance Sprint

Repo: [Ayush-840/SubstationAI](https://github.com/Ayush-840/SubstationAI) · Problem statement: Ministry of Power · 2023 · Software · Smart Education
Team of 3 · Version 4.0 — **supersedes v3.0.** v3.0 assumed building the stack from zero. The repo already exists and works: FastAPI + SQLAlchemy + SQLite, Chroma + BM25 hybrid retrieval, NLP intent/entity layer, a 5-equipment-class test catalog, guided procedures, fault diagnosis with DGA rules, two roles (User/Admin), and an evaluation harness (30 cases, 34 backend tests, 100% intent accuracy, 93% entity accuracy). This document only covers what's **missing for full marks** and **new** against the three rubrics, built as a 15-day sprint on top of the working app.

---

## 1. Why This Document Exists

Only 4 commits exist on `main` as of Oct 12. Development-consistency is graded daily and cannot be backdated (5 of 15 ISD marks). Everything below is scoped and sequenced so that **all three teammates commit something real every day for 15 days**, while closing the specific gaps below. Nothing already working is rebuilt or risked.

## 2. Gap Analysis Against the Rubrics

| Rubric | Current state | Gap | Addressed by |
|---|---|---|---|
| **DBMS — SQL (Rubric A)** | SQLite via SQLAlchemy; schema exists in code | No submitted ER diagram, no data dictionary, no documented representative query set | FR-1, Day 1–2 |
| **DBMS — ORM (Rubric B)** | SQLAlchemy used for CRUD | No documentation of model-to-schema mapping, relationships, or raw-SQL justification | FR-1, Day 1–2 |
| **DBMS — MongoDB (Rubric C)** | **Absent entirely** — a polyglot project with no NoSQL component likely scores the DBMS component on Rubric A alone, well under what a polyglot design could earn | FR-2, Day 2–5 |
| **ASD — Authentication** | JWT login/logout exists | No refresh-token rotation or expiry/renewal story documented | FR-3, Day 6 |
| **ASD — Authorization** | Two roles (User, Admin) | Fault diagnosis and DGA are engineer-level tools gated only by being logged in, not by role; no ownership checks documented | FR-4, Day 7 |
| **ASD — API Design** | Endpoints work | No consistent envelope, no pagination/filtering/sorting on list endpoints, no versioning | FR-5, Day 6 |
| **ASD — Security** | Basic auth | No rate limiting, no documented CORS/security-header policy | FR-6, Day 8 |
| **ASD — Advanced Capabilities (≥2)** | SSE streaming + LLM integration already count as two | Add a third for headroom and to directly solve a real need | FR-7, Day 9–10 |
| **ASD — Deployment & Docs** | Docker Compose locally | No public deployed link; no exported API/architecture docs | FR-8, Day 14 |
| **Problem statement coverage** | Procedure, limits, troubleshooting, standards, equipment, safety all answered via chat | No dedicated **Result Checker** (enter a measured value, get a verdict against the catalog limit) — the most literal reading of "probable values/acceptable limits" in the problem statement | FR-9, Day 7–9 |
| **ISD — Development Consistency** | 4 commits total | No daily cadence, no evidence of 3 contributors | Day-by-day plan below, all 15 days |

## 3. New Features (Functional Requirements)

| ID | Requirement | Rubric it earns marks under |
|---|---|---|
| FR-1 | ER diagram, data dictionary, and a documented set of real queries (joins, GROUP BY/HAVING, subquery or CTE) run by the actual app | DBMS A, B |
| FR-2 | **MongoDB** for conversations, messages (with embedded citations), feedback, and fault logs — justified by access pattern, not mirrored from SQL | DBMS C |
| FR-3 | Refresh-token rotation, revocation on logout, documented expiry | ASD Auth |
| FR-4 | Three roles — **Trainee, Engineer, Admin** — enforced centrally; fault diagnosis and DGA require Engineer+; ownership checks on conversations/feedback/procedure runs | ASD AuthZ |
| FR-5 | Response envelope, pagination/filtering/sorting on catalog and conversation-list endpoints, `/api/v1` versioning | ASD API Design |
| FR-6 | Rate limiting on login and chat; CORS allow-list; security headers | ASD Security |
| FR-7 | Redis cache for repeated catalog/answer lookups (third advanced capability, cuts LLM calls and latency) | ASD Advanced Capabilities |
| FR-8 | Deployed public link; exported OpenAPI; README/architecture docs updated to match reality | ASD Deployment & Docs |
| FR-9 | **Result Checker:** user enters equipment, test, measured value, unit → deterministic within/borderline/outside verdict against `test_limits`, with the cited limit | Product completeness; a live SQL query for the viva |
| FR-10 | ER diagram and Mongo collection notes committed as `docs/DB.md`; RUBRIC_CHECKLIST.md kept current as evidence index | DBMS D (viva), overall traceability |

## 4. Non-Goals for This Sprint

- **No migration off SQLite.** The SQL rubric does not require Postgres ("MySQL, PostgreSQL, SQLite, SQL Server, etc." are all acceptable); migrating a working, tested system under a 15-day deadline is a risk with no marks upside. Revisit only after submission if desired.
- No new equipment classes or catalog content beyond what's needed to demo the Result Checker and Mongo features.
- No Hindi/voice/OCR stretch features.

## 5. Team and Daily-Commit Principle

| Member | Owns in this sprint |
|---|---|
| **A — Data & Backend** | MongoDB integration, ER diagram, DB.md, RBAC, refresh tokens |
| **B — API & Platform** | API envelope/pagination/versioning, rate limiting, security headers, Redis cache, deployment |
| **C — Product & Frontend** | Result Checker UI + API, role-aware navigation, conversation history backed by Mongo, docs/README |

Every day, every member pushes at least one meaningful, reviewable commit — a working slice, a test, a migration, or documentation — never a single end-of-sprint dump. See TRD.md §2 for the exact day-by-day breakdown and suggested commit messages.

## 6. Success Criteria

- `docs/DB.md` exists with an ER diagram, data dictionary, 5+ representative SQL queries actually used by the app, and Mongo collection notes with sample documents.
- MongoDB holds conversations, messages, feedback, and fault logs; the SQL catalog remains the source of truth for limits.
- Three roles are enforced and demonstrable; ownership checks pass tests.
- `/api/v1` endpoints return a consistent envelope with pagination/filtering/sorting on at least catalog and conversation lists.
- Rate limiting returns 429 on abuse of `/auth/login` and `/chat/stream`.
- Redis cache measurably cuts repeat-query latency (shown in the eval report).
- Result Checker returns correct verdicts against the existing `test_limits` table and is reachable from the UI.
- App is deployed at a public URL; README reflects the actual stack.
- Commit graph shows all three members committing on all 15 days.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Mongo added late breaks the working eval suite | Mongo is additive (new collections for new data), not a replacement for the SQL catalog; run the existing 34-test suite after each merge |
| RBAC change locks out existing demo users | Add the Engineer role via migration with a default mapping (existing non-admin users → Trainee), update seed data, re-run `pytest -q` before merging |
| 15 days is tight for 3 people around other coursework | Daily tasks are intentionally small (1–3 hours); heavier items (Mongo setup, deployment) are frontloaded earlier in the sprint, lighter items (docs, tests, catalog data) fill the back half and weekends |
| Rate limiting breaks the eval harness (30 rapid-fire calls) | Exempt the eval harness's service account or run it with limits raised via an env var in CI |

## 8. Disclaimer
SubstationIQ is an informational aid and does not replace official procedures, OEM instructions, permits or trained personnel.
