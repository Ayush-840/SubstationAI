# SubstationIQ Backend

Express 5 + PostgreSQL API for SubstationIQ. Plain `pg` driver, one SQL schema
file, no ORM and no code-generation step.

## Requirements

- Node.js 20 LTS or newer
- PostgreSQL 15 or newer (local, Neon, Supabase or Render)

## Setup

```bash
createdb substationiq
cd backend
npm install
cp .env.example .env       # set DATABASE_URL and a 32+ character JWT_SECRET
npm run migrate
npm run seed               # safe to run more than once
npm run dev                # http://localhost:4000/api/health
```

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with `node --watch` |
| `npm start` | Start the API |
| `npm run migrate` | Apply `sql/schema.sql` (idempotent) |
| `npm run seed` | Create the admin and sample catalog (idempotent) |
| `npm test` | Run the Vitest + Supertest suite |

## Environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development`, `test` or `production` |
| `PORT` | API port (default `4000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing secret, at least 32 characters |
| `JWT_EXPIRES_IN` | Token lifetime (default `1d`) |
| `FRONTEND_ORIGIN` | Allowed browser origin(s), comma separated |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed admin account |

## Layout

```
backend/
  sql/schema.sql
  src/
    app.js, server.js
    config/env.js
    db/{pool,migrate,seed}.js
    middleware/{auth,error}.js
    routes/{index,auth,users,equipment,tests,chat}.js
    services/answer.js
  tests/auth.test.js
```

## Tests

`npm test` uses `backend/.env.test`. Create it from the example, point its
`DATABASE_URL` at a throwaway database (the default expects `substationiq_test`)
and create that database first:

```bash
cp .env.test.example .env.test
createdb substationiq_test
npm test
```

## Notes for the viva

- **Why `pg` and plain SQL:** no generated client to drift or break; the schema
  and every query are visible in the repo.
- **JWT:** the payload is `{ sub, role }`; the server still re-reads the user on
  every protected request, so deletes and role changes apply immediately.
- **Role safety:** public registration never reads `role` from the body. Only an
  admin can assign roles.
- **Indexes:** `users (lower(email))` makes login lookups fast and enforces
  case-insensitive uniqueness; `chat_sessions (user_id, updated_at DESC)` and
  `messages (session_id, created_at)` support the chat list and history queries.
- **Foreign keys:** deleting a user cascades to their sessions and messages;
  deleting equipment cascades to its tests.

See the root `README.md` for the ER diagram and full API table.
