# SubstationIQ

Substation maintenance assistant: look up equipment, test procedures and safe
limits, and ask maintenance questions in a chat.

This repository contains a React + Vite frontend and a Node.js backend using
Express 5, Prisma ORM, and PostgreSQL. The backend is a fully typed service
with request ID tracking, security headers, rate limiting, and consistent
error envelopes.

> SubstationIQ is an informational aid. It does not replace official utility
> procedures, OEM instructions, work permits or trained personnel. Sample limits
> in the seed data are placeholders until sourced from the applicable standards.

## Architecture

```text
React + Vite  --HTTPS-->  Express API (/api/v1)  -->  routes --> services
                                                     |
                                                     v
                                           Prisma Client --> PostgreSQL

Request flow: requestId -> helmet -> CORS -> global rate limit ->
  JSON parser -> cookie parser -> v1 router -> requireAuth ->
  per-user chat limiter -> validate(body) -> service handler ->
  central error handler.
```

## Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 LTS | V8 engine, native fetch/fs, great ecosystem |
| Framework | Express 5 | Minimal, huge ecosystem, forwards async errors to error handler automatically |
| ORM | Prisma | Typed queries, built-in migrations, seed hook, include/select avoid N+1 queries |
| Database | PostgreSQL | Relational integrity for users, chats, tests; JSON column for sources |
| Validation | zod | One schema validates body, params and query; also validates env |
| Passwords | native bcrypt (async, thread pool) | Salted automatically, non-blocking hashing (Q5 viva topic) |
| Tokens | jsonwebtoken (access) + random opaque refresh token | Short access lifetime, revocable refresh |
| Security | helmet, cors, express-rate-limit, cookie-parser | Standard hardening: CSP, X-Content-Type-Options, HSTS, CORS allow-list |
| Logging | pino-http (via Prisma log config) | Request logs with request id |
| Tests | vitest, supertest | Fast API tests |

## Getting started

### 1. Prerequisites

- Node.js >= 20
- PostgreSQL running locally or via a managed service (Neon, Supabase, Render)
- npm or yarn

### 2. Install

```bash
cd backend
npm install
cp .env.example .env   # fill secrets, especially DATABASE_URL and JWT_SECRET
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Database

```bash
createdb substationiq
```

### 4. Migrations and seed

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Run the backend

```bash
npm run dev   # http://localhost:4000/api/v1/health
```

### 6. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Locally, leave `VITE_API_URL` empty and let Vite proxy `/api` to
`http://localhost:4000`. On Vercel set `VITE_API_URL` to the deployed API URL
and add the Vercel domain to `FRONTEND_ORIGIN` on the backend.

### Quick API check

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@example.com","password":"password123"}'
```

## Environment variables

| Variable | Purpose | Example |
|---|---|---|
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `PORT` | API port (default `4000`) | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/substationiq?connection_limit=10` |
| `JWT_SECRET` | Signing secret, at least 32 characters | `replace-with-a-random-string-of-at-least-32-characters` |
| `JWT_EXPIRES_IN` | Token lifetime (default `1d`) | `15m` |
| `FRONTEND_ORIGIN` | Allowed origin(s), comma separated | `http://localhost:5173` |
| `ADMIN_EMAIL` | Seed admin account email | `admin@substationiq.dev` |
| `ADMIN_PASSWORD` | Seed admin password | `ChangeMe123!` |
| `LOG_QUERIES` | Enable query logging in Prisma | `true` |

The real `.env` is in `.gitignore`; only `.env.example` is committed.
`env.js` validates every variable at startup and exits with a readable message
if one is missing.

## Database design

Eight tables. Users own chat sessions, sessions own messages; equipment owns
tests; training sessions for XR. See the ER diagram below.

```mermaid
erDiagram
  users ||--o{ chat_sessions : owns\n  chat_sessions ||--o{ messages : contains\n  equipment ||--o{ tests : has\n  users ||--o{ feedback : gives\n  training_sessions ||--o{ ar_scenes : has\n  training_sessions ||--o{ ar_scripts : has\n  training_sessions ||--o{ ar_steps : has\n\n  users {\n    uuid id PK\n    text name\n    text email\n    text passwordHash\n    text role\n    timestamptz created_at\n    timestamptz updated_at\n  }\n  equipment {\n    uuid id PK\n    text name\n    text category\n    text description\n    timestamptz created_at\n  }\n  tests {\n    uuid id PK\n    uuid equipment_id FK\n    text name\n    text procedure\n    text acceptable_limit\n    text standards\n    text safety_notes\n    timestamptz created_at\n  }\n  chat_sessions {\n    uuid id PK\n    uuid user_id FK\n    text title\n    timestamptz created_at\n    timestamptz updated_at\n  }\n  messages {\n    uuid id PK\n    uuid session_id FK\n    text role\n    text content\n    jsonb sources\n    timestamptz created_at\n  }\n  training_sessions {\n    uuid id PK\n    uuid user_id FK\n    text mode\n    jsonb xr_data\n    timestamptz created_at\n    timestamptz updated_at\n  }\n  ar_scenes {\n    uuid id PK\n    uuid training_session_id FK\n    text mode\n    text script_path\n    jsonb step_order\n    timestamptz created_at\n  }\n  ar_scripts {\n    uuid id PK\n    uuid scene_id FK\n    text name\n    text script\n    timestamptz created_at\n  }\n  ar_steps {\n    uuid id PK\n    uuid script_id FK\n    int step_number\n    text description\n    text hazard_zone\n    timestamptz created_at\n  }\n  feedback {\n    uuid id PK\n    uuid messageId FK\n    uuid userId FK\n    int rating\n    text comment\n    timestamptz created_at\n  }\n\n  equipment ||--o{ tests : has\n  users ||--o{ chat_sessions : owns\n  chat_sessions ||--o{ messages : contains\n  training_sessions ||--o{ ar_scenes : has\n  ar_scenes ||--o{ ar_scripts : contains\n  ar_scripts ||--o{ ar_steps : contains\n  feedback ||--o{ messageId : relates\n  users ||--o{ feedback : gives\n}
```

Key constraints and indexes:

- `users_email_lower_uq` on `lower(email)` gives case-insensitive uniqueness and
  fast login lookups.
- `tests (equipment_id, name)` is unique; `tests_equipment_idx` supports listing.
- `chat_sessions (user_id, updated_at DESC)` supports the paginated session list.
- `messages (session_id, created_at)` supports ordered history.
- Deleting a user cascades to sessions and messages; deleting equipment cascades
  to tests.
- Training sessions link to XR AR data (ArScene, ArScript, ArStep).
- Feedback is unique per (messageId, userId).

The schema is in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## API

Base path `/api/v1`. Errors always use the standard envelope format:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "message": "Invalid email" }], "requestId": "b3c1..." } }
```

Protected routes need `Authorization: Bearer <token>`.

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/health` | none | `200 { status: "ok" }` |
| GET | `/ready` | none | `200` when `SELECT 1` succeeds, else `503` |
| POST | `/auth/register` | none | `201 { token, user }` |
| POST | `/auth/login` | none | `200 { token, user }` |
| GET | `/auth/me` | user | `200 { user }` |
| POST | `/auth/change-password` | user | `204` |
| POST | `/auth/refresh` | cookie + CSRF | `200 { accessToken }` |
| POST | `/auth/logout` | cookie + CSRF | `204` |
| GET | `/users` | admin | `200` list (no hashes) |
| POST | `/users` | admin | `201 { user }` |
| PATCH | `/users/:id/role` | admin | `200` |
| DELETE | `/users/:id` | admin | `204` (not self) |
| GET | `/equipment` | user | `200` list |
| POST | `/equipment` | admin | `201` |
| PATCH | `/equipment/:id` | admin | `200` |
| DELETE | `/equipment/:id` | admin | `204` |
| GET | `/equipment/:id/tests` | user | `200` list |
| POST | `/tests` | admin | `201` |
| PATCH | `/tests/:id` | admin | `200` |
| DELETE | `/tests/:id` | admin | `204` |
| GET | `/chat/sessions?page=&limit=` | user | `200` paginated |
| POST | `/chat/sessions` | user | `201` |
| PATCH | `/chat/sessions/:id` | owner | `200` |
| DELETE | `/chat/sessions/:id` | owner | `204` |
| GET | `/chat/sessions/:id/messages` | owner | `200` |
| POST | `/chat` | user | `200 { sessionId, answer, sources }` |
| PUT | `/messages/:id/feedback` | user | `200` idempotent upsert |
| GET | `/admin/xr-stats` | admin | `200` stats |

Rules:

- A user can only read or write their own sessions (`user_id = $1`).
- A missing or foreign session returns `404`, not `403`.
- Public registration always creates `role = 'user'`; a client cannot self-assign
  `admin`.
- An admin cannot delete or demote their own account.
- Feedback uses PUT with upsert, so repeating it never duplicates.
- `/chat` answers from the catalog via `getAnswer(question, history)`.
- Rate limiting: global 300 per 15 min per IP; `/auth/login` and `/auth/register`
  10 per 15 min per IP; `/chat` 20 per minute per user.

`POST /chat` answers from the catalog via `backend/src/services/answer.js`
(`getAnswer(question, history)`). It keyword-matches equipment and test names,
then returns the stored procedure, limit and safety notes.

## Testing

```bash
createdb substationiq_test
cd backend
cp .env.test.example .env.test   # change DATABASE_URL for your machine
npm test
```

The suite uses `backend/.env.test` (change `DATABASE_URL` for your machine). It
covers: register success, duplicate email `409`, invalid email `422`, short
password `422`, login success, wrong password `401`, `/auth/me` with and without
a token, a normal user hitting an admin route (`403`), user A on user B's session
(`404`), refresh rotates and the old token fails; login 11 times gives `429`;
pagination limit=1000 gives `422`; seed twice leaves one admin.

## Deployment

| Part | Host | Settings |
|---|---|---|
| Database | Neon, Supabase or Render Postgres | copy the connection string into `DATABASE_URL` |
| Backend | Render web service (Docker) | env vars from `.env.example`; the container runs `prisma migrate deploy` + `prisma db seed` on boot |
| Frontend | Vercel | root `frontend`, build `npm run build`, output `dist`, set `VITE_API_URL` |

`render.yaml` describes the API service and database. Check
`https://<backend>/api/ready` before testing the UI.

### Docker

The Dockerfile builds the Node backend, runs Prisma migrations and seed on start,
and serves the API. See `Dockerfile` and `render.yaml` for the full config.

Ensure `COPY backend/requirements.txt` is not present — the backend is now
Node.js, not Python. The `requirements*.txt` files no longer exist in the repo.

## Security

- Passwords hashed with native bcrypt (async, runs in the libuv thread pool);
  minimum length 8.
- JWT signed with `JWT_SECRET`; the user is re-read from the database on every
  protected request so deleted users and role changes take effect immediately.
- Parameterised SQL only (`$1`, `$2`), never string concatenation.
- `passwordHash` is never returned; a client-sent `role` is never trusted.
- `helmet`, CORS allow-list, 100 kb body limit, auth and global rate limits.
- `trust proxy` is set in production so rate limiting sees real client IPs.
- Hosted PostgreSQL uses SSL.
- CSP and XR Permissions-Policy updated for XR deployment (see `frontend/vercel.json`).

## Viva notes

- **Why Prisma and PostgreSQL:** typed queries, built-in migrations, seed hook,
  include/select avoid N+1 queries, query logging. One Prisma client for the
  whole app (pooled connection), migration folder, idempotent seed script.
- **How JWT works:** login signs `{ sub, role }`; protected routes verify the
  signature, then load the user row from the database before authorising.
- **Why the role is never taken from the client:** privilege escalation is
  impossible through public registration or profile updates.
- **How foreign keys and indexes support chat:** `user_id` scoping plus the
  `(user_id, updated_at DESC)` index make the paginated session list cheap;
  `(session_id, created_at)` makes ordered history cheap; cascades keep orphan
  rows out.
- **N+1 avoidance:** GET `/equipment/:id` uses Prisma `include: { tests: {
  select: {...} } }`, which Prisma runs as two queries total, not one per test.

## Roadmap

- Phase 1: auth, roles, catalog, chat with keyword-based `getAnswer`, tests, deployment.
- Phase 2: pgvector, document ingestion, embeddings and real retrieval.
- Phase 3: XR AR/VR trainer integration (currently implemented in separate branch).