# RUBRIC_CHECKLIST.md — Marks Map and Viva Prep

Tick each row only when the evidence exists in the repo or deployed app. Add links in the Evidence column.

---

## 1. ISD (Interactive Systems Development), 15 marks

| Criterion (marks) | What earns full marks | Evidence | Done |
|---|---|---|---|
| Development consistency (5) | Meaningful commits every day by all three members; gradual progress | GitHub commit graph, portal activity | ☐ |
| Core functionality (4) | All major features work: chat, catalog, procedures, result checker, admin | Demo script runs end to end | ☐ |
| Structure and code quality (2) | Components/modules split sensibly, little duplication, clear names | Frontend `components/`, `pages/`, `hooks/`, `api/` | ☐ |
| Usability (2) | Clear flows, feedback on every action, loading/empty/error states | DESIGN.md checklist, screenshots | ☐ |
| Completeness and stability (2) | Starts cleanly, no crashes in demo, workflows complete | Fresh-clone `docker compose up`, deployed link | ☐ |

## 2. ASD (Backend), 10 criteria

| # | Criterion | What to show | Evidence | Done |
|---|---|---|---|---|
| 1 | Architecture and code organisation | Routers → services → repositories; cohesive modules | TRD §3, folder tree | ☐ |
| 2 | API design | `/api/v1`, correct verbs and codes, one envelope, pagination, filtering, sorting | OpenAPI export, TRD §4 | ☐ |
| 3 | Data modeling and persistence | Real domain schema, constraints, Alembic migrations, realistic seed data, selective queries | `schema.sql`, migrations, `seed.py` | ☐ |
| 4 | Authentication | Argon2/bcrypt, access + rotating refresh tokens, expiry, logout revokes | Auth tests, TRD §5 | ☐ |
| 5 | Authorization | Three roles enforced centrally; ownership rules | RBAC tests, TRD §6 table | ☐ |
| 6 | Validation and errors | Pydantic on all input, central handlers, no internals leaked, stable on bad input | Error tests, `core/errors.py` | ☐ |
| 7 | Security practices | HTTPS, rate limits on login and chat, CORS allow-list, security headers, minimal data exposure | TRD §8, 429 test | ☐ |
| 8 | Advanced capabilities (≥ 2) | SSE streaming, LLM + email integration, Redis caching, ARQ background/cron | Demo + code links | ☐ |
| 9 | Deployment, config, docs | Env-based config, deployed link, README, architecture, data model, API usage | README, docs/ folder | ☐ |
| 10 | Engineering practices | Readable code, PR-based history, tests, logging, CI | CI badge, coverage report, PR list | ☐ |

## 3. DBMS, three rubrics averaged (each out of 100)

### A. SQL (PostgreSQL)
| Pillar | What to show | Evidence | Done |
|---|---|---|---|
| Design and modeling (30) | ER diagram with entities, keys, cardinalities, junction tables (N:N), tailored to the domain, matching the schema | `docs/er-diagram.png`, DB.md §2.1 | ☐ |
| Query writing (30) | Joins, GROUP BY/HAVING, subqueries, CTE, integrity-respecting DML, ability to write a new query live | DB.md §2.3 (Q1 to Q7) | ☐ |
| Keys, constraints, accuracy (20) | PK/FK, NOT NULL, UNIQUE, CHECK, DEFAULT, right data types | `schema.sql` | ☐ |
| Documentation and viva (20) | Data dictionary; explain schema and each query | DB.md §2.2 | ☐ |

### B. ORM (SQLAlchemy)
| Pillar | What to show | Evidence | Done |
|---|---|---|---|
| Model definitions (25) | Models mirror DDL; validations; enums | `db/models/` | ☐ |
| CRUD via ORM (25) | Repositories with filter/sort/pagination; knows the SQL underneath | `repositories/` | ☐ |
| Relationship mapping (25) | 1:N, N:N, cascades, eager loading where needed | DB.md §3 | ☐ |
| Justification and viva (25) | Why an ORM, where raw SQL is used and why, how a model change becomes a migration | DB.md §3 | ☐ |

### C. MongoDB
| Pillar | What to show | Evidence | Done |
|---|---|---|---|
| Document design (30) | Collections built around access patterns; embed vs reference justified; consistent shapes | DB.md §4.1 | ☐ |
| CRUD and aggregation (30) | insert/find/update/delete with operators and projections; `$lookup`, `$group`, `$project` | DB.md §4.3 | ☐ |
| Modeling reasoning (20) | Why MongoDB; how duplicated info stays consistent; ObjectId references | DB.md §4.4, 4.5 | ☐ |
| Documentation and viva (20) | Sample document per collection; explain choices live | DB.md §4.2 | ☐ |

**Not graded:** normalization, ACID, indexing, performance. Do not present them as achievements.

---

## 4. Viva Preparation

The whole group is examined together, and every member must be able to explain everything. Practise by having each person answer questions about the *other* members' parts.

### Product and design
1. What problem does the project solve and for whom? *(Maintenance staff searching scattered manuals; risk of missed safety steps; training new staff.)*
2. Why a hybrid of catalog and RAG? *(Limits and standards must be exact; documents explain and support. The LLM is never the source of a number.)*
3. How do you stop hallucinated limits? *(Catalog-first, sourced records, number verifier, fallback template.)*
4. How does your system handle a question it cannot answer? *(Confidence gate, "not found", logged for admin review.)*

### Backend (ASD)
5. Walk through one request from browser to database and back.
6. Why layers (router, service, repository)? What lives where?
7. How does login work? What happens on token expiry, refresh and logout?
8. Why store refresh tokens hashed and rotate them?
9. How do you enforce that a user can only edit their own data?
10. What happens when someone sends invalid or malicious input?
11. Which security measures did you apply and against which attack?
12. Which two or more advanced capabilities did you build and what need does each solve?
13. How is configuration handled between local and deployed environments?
14. What do your tests cover? Show one.

### Database
15. Explain your ER diagram: entities, relationships, cardinalities. Where are your N:N relationships?
16. Why is `source_id` NOT NULL on `test_limits`?
17. Write, on the spot: tests with their number of limits, only those with none *(LEFT JOIN + GROUP BY/HAVING or NOT EXISTS)*.
18. Why did you use an ORM? Where and why did you use raw SQL?
19. What is `selectinload` and why did you use it there?
20. How does adding a column flow from model to migration to database?
21. Why is chat data in MongoDB while the catalog is in PostgreSQL?
22. Why are messages a separate collection but citations embedded?
23. How do MongoDB documents stay consistent with PostgreSQL ids? *(No hard deletes for users; only ids stored; catalog remains the source of truth.)*
24. Show an aggregation pipeline and explain each stage.

### Frontend and NLP
25. How do streaming answers reach the UI? *(SSE events: intent, token, citations, safety, done.)*
26. How do you handle expired access tokens in the client?
27. How does the system understand "megger test on a CT"? *(Synonym table, entity matcher, intent classifier.)*
28. What is Reciprocal Rank Fusion and why did you use it?
29. What did your evaluation show? Which ablation surprised you?

### Team
30. Who built what, and how did you review each other's work? Show PRs.

---

## 5. Common Ways Teams Lose Marks (avoid these)

- Commits bunched in the last week, or one member with almost no commits
- ER diagram that does not match the real schema
- Presenting normalization, indexing or ACID as features (not graded; can waste viva time)
- MongoDB added "for show" with no justification
- Scattered raw SQL in routers instead of a repository layer
- Missing ownership checks (any user can read another's chats)
- Stack traces or internal messages returned to clients
- Demo depends on a single network-dependent service with no fallback
- A teammate who cannot explain the other layers
