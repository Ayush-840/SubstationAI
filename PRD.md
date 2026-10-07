# PRD — SubstationIQ (Capstone Edition)

**Intelligent chatbot for substation maintenance processes**
Problem statement: Ministry of Power · 2023 · Software · Smart Education
Team of 3 · One integrated project across Interactive Systems, Advanced Software Development and Data Engineering · Version 3.0

---

## 1. Product Summary

SubstationIQ answers questions about substation maintenance in natural language and returns **structured, cited answers**: the test **procedure**, **acceptable limits**, **actions to resolve issues**, **applicable standards**, **safety guidelines** and **test equipment**. It understands questions semantically (synonyms, abbreviations, follow-ups), never invents numbers, and doubles as a **training tool** for new engineers (Smart Education).

**Equipment classes:** Power Transformer, Reactor, Circuit Breaker, Instrument Transformer (CT/PT/CVT), Surge Arrester (extensible to isolators, batteries, earthing).

## 2. Problem Statement Traceability

| Problem statement | Requirement |
|---|---|
| Transformer, Reactors, CB, Instrument Transformers, Surge Arrestors | Catalog and knowledge base per equipment class (FR-1, FR-2) |
| Tests with procedures | Procedure answers and guided procedure runs (FR-5, FR-16) |
| Probable values / acceptable limits | Sourced limits, condition-aware, plus result checker (FR-6, FR-19) |
| Actions to resolve issues | Troubleshooting answers and fault diagnosis (FR-7, FR-17) |
| NLP chatbot, semantic processing | Intent detection, entity and synonym handling, embedding retrieval (FR-3, FR-4) |
| Industrial standards | Standards on every test (FR-8) |
| Safety guidelines | Fixed safety blocks and guardrails (FR-9) |
| Test equipment | Instrument list per test (FR-10) |

## 3. Capstone Requirements Mapping

| Capstone requirement | How SubstationIQ satisfies it |
|---|---|
| **Interactive Systems (ISD):** app of your choice | **Web app** (React), allowed for online delivery |
| **Advanced Software Development:** backend | FastAPI, layered, versioned REST API, JWT auth with refresh, RBAC, validation, security, Redis caching, background jobs, streaming |
| **Data Engineering:** database | PostgreSQL (SQL rubric + ORM rubric) and MongoDB (NoSQL rubric), with ER diagram, DDL, queries, collection design |
| Consistent daily commits | Team work-split and daily-commit plan in BUILD_GUIDE.md |
| Group viva | Cross-training plan and viva prep in RUBRIC_CHECKLIST.md |

## 4. Users and Roles

| Role | Description | Key permissions |
|---|---|---|
| **Trainee** (default) | New technician or student | Chat, learn mode and quizzes, guided procedures, result checker, own history |
| **Engineer** | Experienced maintenance staff | Everything a trainee can do, plus fault diagnosis, DGA tool, create and edit draft catalog entries |
| **Admin** | Knowledge manager | Everything, plus verify catalog entries, upload documents, user management, analytics |

Ownership rule: users can view, edit and delete only their own conversations, feedback, procedure runs and quiz attempts.

## 5. Functional Requirements

### P0 (must have; core marks)
| ID | Requirement |
|---|---|
| FR-1 | Five equipment classes with a knowledge base |
| FR-2 | Structured test catalog (steps, limits, instruments, standards, safety, troubleshooting) with draft and verified states; every limit has a source |
| FR-3 | Chat with streaming answers and saved history |
| FR-4 | Semantic query processing: intent, equipment/test recognition, synonyms and abbreviations, follow-ups, clarifying questions |
| FR-5 | Procedure answers (ordered steps) |
| FR-6 | Limits answers with units, conditions, standard and source |
| FR-7 | Troubleshooting answers (probable causes, actions) |
| FR-8 | Standards references on answers |
| FR-9 | Safety guidance on every relevant answer; refusal to help bypass safety devices |
| FR-10 | Test equipment list per activity |
| FR-11 | Citations on every answer |
| FR-12 | "Not found" behaviour with logging of unanswered queries |
| FR-13 | Register, login, refresh, logout, password reset; roles enforced |
| FR-14 | Admin: upload and manage documents, verify catalog entries |
| FR-15 | Catalog browser (search, filter, sort, paginate) |

### P1 (should have; differentiators)
| ID | Requirement |
|---|---|
| FR-16 | **Guided Procedure Mode:** checklist with mandatory safety confirmations, saved runs, PDF export |
| FR-17 | **Fault Diagnosis:** symptoms and readings to ranked probable causes with sources |
| FR-18 | **Learn Mode:** plain-language explanations and quizzes with progress tracking |
| FR-19 | **Result Checker:** enter a measured value, get within / borderline / outside limits with the cited limit |
| FR-20 | **DGA tool:** dissolved gas analysis interpretation with an interactive Duval triangle plot, implemented from the published standard (IEC 60599 / IEEE C57.104) |
| FR-21 | Answer feedback and admin analytics (top questions, unanswered, ratings) |
| FR-22 | Evaluation dashboard (intent accuracy, retrieval, faithfulness, limit exactness, latency) |

### P2 (stretch)
Hindi and English, voice input, nameplate OCR, weekly email digest of unanswered queries to admins.

## 6. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Accuracy | ≥ 85% answer correctness; **100% of shown limits match the catalog or cited source** |
| Latency | First token < 3 s; p50 full answer < 8 s (cached answers < 1 s) |
| Security | HTTPS, hashed passwords, JWT with expiry and refresh, RBAC, rate limiting, CORS allow-list, validated input, no internal errors exposed |
| Reliability | LLM provider fallback; health and readiness endpoints |
| Usability | Responsive, field-friendly, WCAG AA contrast |
| Maintainability | Layered code, tests, structured logs, CI |

## 7. Success Metrics

| Metric | Target |
|---|---|
| Intent accuracy | ≥ 90% |
| Entity recognition (equipment, test) | ≥ 90% |
| Answer correctness (100-item set) | ≥ 85% |
| Limit exact match | 100% |
| Citation accuracy | ≥ 90% |
| Refusal accuracy (out-of-scope, unsupported) | ≥ 90% |
| Safety notice on live-equipment answers | 100% |
| Backend test coverage on services layer | ≥ 70% |
| Pilot: 10+ users (classmates, one faculty reviewer), positive feedback | ≥ 80% |

## 8. What Makes It Stand Out

1. **Safety-first design:** fixed, non-LLM safety blocks and an interlock-bypass refusal.
2. **Trust by construction:** limits come only from a verified, sourced catalog; a number-verification step blocks invented values.
3. **Verification workflow:** engineers draft, admins verify; only verified records power answers.
4. **Real engineering tools:** result checker and DGA Duval triangle.
5. **Smart Education:** learn mode, quizzes, progress tracking.
6. **Evidence:** evaluation report with ablations (RAG only vs catalog + RAG; vector vs keyword vs hybrid vs rerank).
7. **Real-world validation:** short pilot with electrical-department students or faculty, with feedback in the report.
8. **Polish:** deployed link, CI badge, clean README, 3-minute demo video.

## 9. Scope Boundaries

- No live SCADA, no control actions, not a replacement for official procedures or permits.
- Sample SOPs are labelled as samples; limits are taken from cited public sources.
- Native mobile apps are out of scope (responsive web only).

## 10. Team Roles (3 members, assigned by the course)

| Member | Focus | Also owns |
|---|---|---|
| **A: Intelligence** | NLP, retrieval, LLM integration, guardrails, evaluation | Catalog content for 2 to 3 equipment classes |
| **B: Backend & Data** | FastAPI core, auth/RBAC, PostgreSQL + MongoDB, migrations, Redis and jobs, security, deployment | Catalog content for 1 to 2 classes, DB documentation |
| **C: Frontend & Product** | React app, UX, guided procedures, learn mode, testing, demo and documentation | Catalog content for 1 to 2 classes, design doc |

Everyone: reviews at least half of the others' pull requests, and commits daily. Detailed plan in BUILD_GUIDE.md.

## 11. Milestones

| Phase | Weeks | Outcome |
|---|---|---|
| Foundation | 1 | Repo, CI, Docker, schema, auth skeleton, first catalog entries |
| Core | 2 to 4 | Catalog + ingestion + retrieval + chat working end to end |
| Product | 5 to 6 | Structured answers, guardrails, procedures, RBAC, admin, analytics |
| Differentiators | 7 | Result checker, DGA tool, learn mode, evaluation |
| Finish | 8 | Deployment, docs, report, demo video, viva prep |

_If the semester timeline is shorter, compress by cutting P1 items in this order: DGA tool, quizzes, PDF export._

## 12. Risks

| Risk | Mitigation |
|---|---|
| Limited real documents | Public OEM manuals and standards; label samples; source every limit |
| Wrong limits in catalog | Mandatory source, validator in CI, admin verification, faculty spot-check |
| Team of 3 unevenly loaded | Vertical slices, shared catalog work, PR reviews |
| Too many services for the timeline | Docker Compose; managed free tiers; cut P1 first |
| LLM quota | Caching, provider fallback, offline model option |
| Viva gaps | Weekly cross-training sessions; viva Q&A in RUBRIC_CHECKLIST.md |

## 13. Deliverables

Deployed app · GitHub repo with meaningful history · README · PRD, TRD, DESIGN, DB docs · ER diagram, DDL, queries, Mongo collection notes · Evaluation report · Project report · Demo video · Viva readiness.

## 14. Disclaimer
SubstationIQ is an informational aid and does not replace official procedures, OEM instructions, permits or trained personnel.
