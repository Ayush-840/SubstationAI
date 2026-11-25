# PRD — SubstationIQ, ASD Viva Aligned

Stack: Node.js 20 · Express 5 · Prisma · PostgreSQL · Date: 25 Nov 2026

This document covers the backend and database only, because that is what the viva grades.
The AI answer logic sits behind one function, `getAnswer(question, history)`, so the
retrieval and LLM work can grow later without touching the API layer.

## 1.1 Purpose and scope

SubstationIQ lets substation engineers browse equipment and test procedures and
chat with an assistant about maintenance. This document covers the backend and
database only, because that is what the viva grades. The AI answer logic sits
behind one function, `getAnswer(question, history)`, so the retrieval and LLM work
can grow later without touching the API layer.

## 1.2 Rubric traceability (what the project must contain)

| Viva question | What the project must have | Evidence to show on screen |
|---|---|---|
| **Q1 Architecture and request life** | Routes → controllers → services → Prisma; versioned `/api/v1`; ordered middleware | Folder tree, `app.js`, one live POST `/chat` request with logs |
| **Q2 REST design** | Resource URLs, correct verbs and status codes, zod validation, one error format, central handler | Endpoint list, one valid and one invalid request, `error.js` |
| **Q3 Auth and access control** | Access token + refresh token, hashed passwords, roles, ownership checks | Login route, hashed password in DB, 401 / 403 / cross-user rejection |
| **Q4 Security** | Helmet, CORS allow-list, three rate limiters, input sanitising, CSRF handling, secrets in `.env`, no leaks | Headers in a response, a live 429, `.gitignore`, `.env.example` |
| **Q5 Database and non-blocking I/O** | Single Prisma client, migrations, idempotent seed, filtered and paginated list, no N+1 | Client file, migration folder, seed, query log with filters |

## 1.3 Roles

- **USER:** register, log in, browse catalog, chat, give feedback, change own password.
- **ADMIN:** all of the above plus manage users, equipment and tests, and view stats.

## 1.4 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Register (always role USER; duplicate email gives 409) | P0 |
| FR-2 | Login returns a short-lived access token and sets a refresh cookie | P0 |
| FR-3 | Refresh rotates the refresh token; logout revokes it | P0 |
| FR-4 | GET `/auth/me` | P0 |
| FR-5 | Admin creates users, changes roles, deletes users (not self) | P0 |
| FR-6 | Equipment CRUD (admin writes, users read) | P0 |
| FR-7 | Tests CRUD linked to equipment; list with filter, sort, pagination | P0 |
| FR-8 | Chat sessions CRUD, each visible only to its owner | P0 |
| FR-9 | POST `/chat` stores the question and answer and returns answer plus sources | P0 |
| FR-10 | Feedback on an assistant message (one per user per message, upsert) | P1 |
| FR-11 | Health and readiness endpoints | P0 |
| FR-12 | Seed script (admin, sample equipment and tests), safe to run repeatedly | P0 |

## 1.5 Non-functional requirements

- Secure by default; one consistent error format; no stack traces in production;
  responses under 300 ms on indexed queries; setup from a clean clone in under 10
  minutes; every viva demo reproducible with one command.

## 1.6 Acceptance criteria (this is also your demo checklist)

1. Clean clone: install, migrate, seed, run, with no manual fixes.
2. Request with no token returns 401; a USER calling an admin route returns 403;
   User A requesting User B's chat session is rejected.
3. Duplicate register returns 409; invalid body returns 422 in the standard error format.
4. Hitting the login route 11 times in 15 minutes returns 429.
5. A list request with filter, sort and pagination shows the exact SQL in the log.
6. A production-mode crash returns a generic message and no stack trace.

## 1.7 Design decisions

- **Prisma over plain pg driver:** gives migrations, idempotent seed, query logging,
  filtered/paginated lists, and N+1 avoidance via `include`/`select` — all with
  very little code. Native bcrypt (async, thread pool) also satisfies Q5 on
  non-blocking hashing.
- **Express 5:** minimal, huge ecosystem, forwards async errors to the error
  handler automatically.
- **zod:** one schema validates body, params and query, and also validates env.
- **Endpoint versioning:** all routes under `/api/v1`.
- **Standard error format:** `{ error: { code, message, details, requestId } }`
  everywhere, formatted by the central error handler.

## 1.8 New features (compared to old FastAPI+SQLite baseline)

| ID | Feature | Rubric |
|---|---|---|
| FR-12 | Prisma schema with migrations and idempotent seed script | DBMS B |
| FR-13 | zod-validated environment env file | Q1, Q5 |
| FR-14 | Three rate limiters (global, login/register, chat) | Q4 |
| FR-15 | Standard error envelope with requestId | Q2, Q4 |
| FR-16 | Refresh token rotation + revocation on logout | Q3 |
| FR-17 | Ownership checks via `user_id` filter in every chat/query operation | Q3, Q5 |