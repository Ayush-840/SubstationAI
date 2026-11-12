# SubstationAI Backend

Express and Prisma API for substation equipment, test procedures, documents, and chat. AI answers and document ingestion remain stubs; no RAG, embeddings, vector queries, or LLM calls are included.

## Stack

Node.js, Express, PostgreSQL (Neon compatible), Prisma, JWT, bcrypt, Zod, Helmet, express-rate-limit, Swagger UI.

## Setup

1. Clone the repository and `cd backend`.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set values.
4. Run `npx prisma migrate deploy`.
5. Run `npx prisma generate`.
6. Run `npm run seed`.
7. Run `npm run dev`.

Interactive API docs: `http://localhost:4000/api/docs`; health check: `http://localhost:4000/api/health`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (default 4000) |
| `NODE_ENV` | Runtime mode |
| `JWT_SECRET` | JWT signing secret |
| `JWT_EXPIRES_IN` | Token lifetime |
| `CLIENT_URL` | Allowed browser origin |
| `UPLOAD_DIR` | Document upload directory |
| `MAX_FILE_SIZE_MB` | Upload size cap |
| `RATE_LIMIT_WINDOW_MS` | General API rate window |
| `RATE_LIMIT_MAX` | General API request cap |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed admin credentials |

## Layout

`server.js` starts Express; `src/routes` maps endpoints; `src/controllers` handles HTTP; `src/services` contains chat/document workflows; `src/middleware` contains auth, validation, and limits; `src/ai/index.js` exports current stubs; `src/docs/openapi.js` defines API docs; `prisma` contains schema and seed data.

## Endpoint summary

- Auth: register, login, current user, change password
- Equipment and tests: browse/search; ADMIN create, update, delete
- Documents: browse; ADMIN upload, delete, reingest
- Chat: sessions, standard chat, SSE at `/api/chat/stream`
- Admin: statistics, user listing, role changes, user deletion

## Roles

New registrations receive `ENGINEER`. Engineers can browse and use chat. `ADMIN` users can manage equipment, tests, documents, and users. Admin routes require an authenticated ADMIN JWT.

## Replacing AI stubs

Person 2 can replace the stubs by changing **only** `src/ai/index.js` to export `getAnswer` and `ingestDocument` from `../rag/index.js`:

```js
export { getAnswer, ingestDocument } from "../rag/index.js";
```

Keep that module contract stable.

## Shared Neon database

Share the `.env` privately with teammates who need the shared Neon database. Never commit `.env` or send credentials in public channels.
