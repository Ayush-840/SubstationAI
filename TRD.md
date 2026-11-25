# TRD — SubstationIQ Technical Requirements

Version 2.1 · Companion to PRD.md, README.md

## 2.1 Technology choices and reasons (you must say why in Q1 and Q5)

| Need | Choice | Reason |
|---|---|---|
| **Framework** | Express 5 | Minimal, huge ecosystem, forwards async errors to the error handler automatically |
| **ORM / migrations** | Prisma | Typed queries, built-in migrations, seed hook, include/select avoid N+1 queries, query logging |
| **Database** | PostgreSQL | Relational integrity for users, chats, tests; JSON column for sources |
| **Validation** | zod | One schema validates body, params and query, and also validates env |
| **Passwords** | native bcrypt (async, runs in the libuv thread pool) | Salted automatically, async in thread pool — non-blocking (Q5 viva topic) |
| **Tokens** | jsonwebtoken (access) + random opaque refresh token | Short access lifetime, revocable refresh |
| **Security** | helmet, cors, express-rate-limit, cookie-parser, sanitize-html | Standard hardening |
| **Logging** | pino-http (via Prisma log config) | Request logs with request id |
| **Tests** | vitest, supertest | Fast API tests |

## 2.2 Architecture and request lifecycle

**Layers:** routes (URL to handler, validation, auth) → controllers (HTTP in, HTTP out) → services (business rules, Prisma queries) → Prisma → PostgreSQL. Models live in `prisma/schema.prisma`.

**Trace of POST `/api/v1/chat`:**
- request id → logger → helmet → CORS → global rate limit → JSON parser → cookie parser → v1 router → requireAuth → per-user chat limiter → validate(body) → chat controller → chat service (checks session ownership, saves user message with Prisma, calls `getAnswer`, saves assistant message) → JSON response 200/201 → on any throw, the error handler.

**Middleware order and what breaks if swapped (Q1 asks for this):**

| Order rule | If swapped |
|---|---|
| Request id and logger first | Errors and 429s have no id and are not logged |
| Helmet and CORS before routes and rate limiter | Preflight and error responses miss CORS headers, so the browser hides the real error |
| Rate limiter before body parsing and auth | If after auth, attackers hammering login hit the database before being blocked |
| `express.json()` before routers | `req.body` is undefined in every handler |
| `requireAuth` before `requireRole` | `req.user` is undefined, so role checks crash with a 500 |
| Chat limiter after requireAuth | It cannot key by user id and falls back to IP |
| 404 handler then error handler last | Errors thrown by routes are never formatted, Express returns its default HTML page |

## 2.3 Folder structure

```
backend/
  prisma/
    schema.prisma
    migrations/
      20261124193311_xr_training/
  src/
    server.js            # listen, graceful shutdown
    app.js               # middleware order lives here
    config/env.js        # zod-validated environment
    db/prisma.js         # single shared client
    middleware/
      requestId.js  auth.js  role.js  validate.js
      rateLimit.js  csrf.js  error.js
    routes/
      index.js           # /api/v1 router, mounts below
      auth.routes.js  users.routes.js  equipment.routes.js
      tests.routes.js  chat.routes.js  feedback.routes.js
    controllers/         # thin: parse req, call service, send res
    services/            # auth, users, equipment, tests, chat, answer
    validators/          # zod schemas per resource
    utils/AppError.js
  tests/
  .env.example
```

## 2.4 Environment variables (.env.example)

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/substationiq?connection_limit=10
JWT_ACCESS_SECRET=replace-with-48-random-bytes-hex
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
FRONTEND_ORIGIN=http://localhost:5173
LOG_QUERIES=true
ADMIN_EMAIL=admin@substationiq.dev
ADMIN_PASSWORD=ChangeMe123!
```

The real `.env` is in `.gitignore`; only `.env.example` is committed.
`env.js` validates every variable at startup and exits with a readable message if one is missing.

## 2.5 Database schema (prisma/schema.prisma, condensed)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}

enum Role { USER ADMIN }

model User {
  id           String   @id @default(uuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(USER)
  createdAt    DateTime @default(now())
  sessions     ChatSession[]
  tokens       RefreshToken[]
  feedback     Feedback[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model Equipment {
  id          String  @id @default(uuid())
  name        String  @unique
  category    String
  description String?
  tests       Test[]
}

model Test {
  id              String   @id @default(uuid())
  equipmentId     String
  name            String
  procedure       String?
  acceptableLimit String?
  standards       String[]
  safetyNotes     String?
  createdAt       DateTime @default(now())
  equipment       Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  @@unique([equipmentId, name])
  @@index([equipmentId])
}

model ChatSession {
  id        String   @id @default(uuid())
  userId    String
  title     String   @default("New chat")
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  Message[]
  @@index([userId, updatedAt])
}

model Message {
  id        String      @id @default(uuid())
  sessionId String
  role      MessageRole
  content   String
  sources   Json        @default("[]")
  createdAt DateTime    @default(now())
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  feedback  Feedback[]
  @@index([sessionId, createdAt])
}

model Feedback {
  id        String  @id @default(uuid())
  messageId String
  userId    String
  rating    Int
  comment   String?
  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([messageId, userId])
}

model TrainingSession {
  id        String   @id @default(uuid())
  userId    String
  mode      String   // desktop | immersive-vr | immersive-ar
  status    String   // in_progress | paused | completed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  arScenes  ArScene[]
}

model ArScene {
  id            String   @id @default(uuid())
  trainingSessionId String
  mode        String
  scriptPath  String
  stepOrder   Json
  createdAt   DateTime @default(now())
  trainingSession TrainingSession @relation(fields: [trainingSessionId], references: [id], onDelete: Cascade)
}

model ArScript {
  id            String   @id @default(uuid())
  sceneId       String
  name        String
  script      String
  createdAt   DateTime @default(now++)
  scene       ArScene @relation(fields: [sceneId], references: [id], onDelete: Cascade)
}

model ArStep {
  id            String   @id @default(uuid())
  scriptId      String
  stepNumber  Int
  description String
  hazardZone  String?
  createdAt   DateTime @default(now++)
  script      ArScript @relation(fields: [scriptId], references: [id], onDelete: Cascade)
}
```

## 2.6 REST API design (Q2)

**Versioned base path:** `/api/v1`. Plural nouns for resources, verbs only in the HTTP method.

| Method | URL | Auth | Success | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | none | `201` | 409 duplicate, 422 invalid |
| POST | `/auth/login` | none | `200` | 401 wrong credentials; sets refresh cookie |
| POST | `/auth/refresh` | cookie + CSRF | `200` | rotates refresh token |
| POST | `/auth/logout` | cookie + CSRF | `204` | revokes token |
| GET | `/auth/me` | user | `200` | |
| GET | `/ POST` | `/users` | admin | `200` / `201` |
| PATCH | `/users/:id/role` | admin | `200` | 400 if acting on self |
| DELETE | `/users/:id` | admin | `204` | 400 if acting on self |
| GET | `/equipment` | user | `200` | |
| GET | `/equipment/:id` | user | `200` | includes its tests via one include |
| POST | `/equipment` | admin | `201` | |
| PATCH | `/equipment/:id` | admin | `200` | |
| DELETE | `/equipment/:id` | admin | `204` | |
| GET | `/tests?equipmentId=&search=&sort=&order=&page=&limit=` | user | `200` | filter, sort, paginate |
| POST | `/tests` | admin | `201` | |
| PATCH | `/tests/:id` | admin | `200` | |
| DELETE | `/tests/:id` | admin | `204` | |
| GET | `/chat/sessions` | user | `200` / `201` | own sessions only |
| GET | `/ POST` | `/chat/sessions/:id` | owner | `200` / `200` / `204` | not yours gives 404 |
| GET | `/chat/sessions/:id/messages` | owner | `200` | |
| POST | `/chat` | user | `201` | rate limited 20 per minute per user |
| PUT | `/messages/:id/feedback` | user | `200` | idempotent upsert |
| GET | `/health, /ready` | none | `200` / `503` | /ready runs a real query |

**Status codes:** 200 OK, 201 Created, 204 No Content, 400 malformed JSON or bad action,
401 not logged in, 403 wrong role, 404 missing or not yours, 409 conflict, 413 body too large,
422 validation failed, 429 rate limited, 500 unexpected (generic message).

**Idempotency:** GET, PUT, PATCH-to-same-value and DELETE are idempotent. POST is not.
Sending POST `/auth/register` twice returns 201 then 409 (the unique email constraint protects you).
Sending POST `/chat/sessions` twice creates two sessions; say this honestly in the video.
Feedback uses PUT with upsert, so repeating it never duplicates.

**Validation:** one zod schema per resource in `validators/`; the validate middleware checks
params (UUID), query (types, enums, max limit) and body. In Express 5 `req.query` is
read-only, so store the parsed query in `req.validatedQuery`.

**One error format everywhere:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [{ "field": "email", "message": "Invalid email" }], "requestId": "b3c1..." } }
```

## 2.7 Authentication and authorization (Q3)

- **Why token-based:** the frontend is on Vercel and the API on Render, so a stateless
  access token in the Authorization header works across origins without server-side sessions.
- **Access token:** JWT, 15 minutes, payload `{ sub, role }`, held in JavaScript memory
  (not localStorage), so an XSS bug cannot steal a long-lived credential.
- **Refresh token:** 48 random bytes, 7 days, sent only as an httpOnly, Secure, SameSite
  cookie scoped to `/api/v1/auth`. Only its SHA-256 hash is stored in the `RefreshToken`
  table.
- **Rotation:** every refresh revokes the old token and issues a new one. If a revoked
  token is presented again, revoke all of that user's tokens (theft detection).
- **Logout:** revoke the stored token and clear the cookie.
- **Passwords:** `bcrypt.hash(password, 12)`; the salt is generated and stored inside the
  hash string. Passwords are 8 to 72 characters.
- **Authorization:** `requireAuth` verifies the JWT and loads the user; `requireRole('ADMIN')`
  guards admin routes.
- **User A vs User B:** every chat query includes `userId: req.user.id` in the Prisma where.
  A foreign session returns 404, so IDs of other users' data are never confirmed to exist.

## 2.8 Security (Q4)

| Concern | Control |
|---|---|
| **Headers** | `helmet()` (CSP, X-Content-Type-Options, HSTS in production, no X-Powered-By) |
| **CORS** | allow-list from `FRONTEND_ORIGIN`, `credentials: true`, no wildcard |
| **Rate limits** | global 300 per 15 min per IP; `/auth/login` and `/auth/register` 10 per 15 min per IP (stops password guessing); `/chat` 20 per minute per user (protects the costly AI call). Return the standard error body with 429 and `RateLimit` headers. `trust proxy` is set in production so IPs are real. |
| **XSS and unsafe input** | the API only returns JSON; zod enforces types and lengths; free-text fields (names, titles) pass through `sanitize-html` with no tags allowed; React escapes output on the frontend; Prisma parameterises every query, so SQL injection is not possible through it |
| **CSRF** | it applies to the two cookie-based routes (refresh, logout). Defences: SameSite cookie, CORS allow-list, and a required `X-Requested-With: XMLHttpRequest` header (a cross-site form cannot set it). All other routes use the Authorization header, which browsers never attach automatically, so they are not CSRF-able. |
| **Secrets** | `.env` ignored by git, `.env.example` committed, env validated at boot, secrets set in Render and Vercel dashboards. If any secret was ever committed, rotate it. |
| **Crash behaviour** | in production the handler returns `Something went wrong` plus the request id, and logs the stack server-side only. |

## 2.9 Database and non-blocking I/O (Q5)

- **One Prisma client for the whole app** (`src/db/prisma.js`). A new client per request
  would open a new connection pool each time and exhaust PostgreSQL's connection limit.
  Pool size is set with `connection_limit` in the URL.
- **Migrations:** `npx prisma migrate dev --name init` creates SQL files in `prisma/migrations/`
  that you commit; production uses `npx prisma migrate deploy`.
- **Seed:** `prisma/seed-xr.cjs` uses upsert for the admin, equipment and tests, so running
  it twice changes nothing. Wired through `prisma.seed` in `schema.prisma` or `package.json`
  (`npx prisma db seed`). Idempotent — use `onConflictDoNothing` or gate the whole seed
  behind a check such as "only seed if the `users` table is empty."
- **Related data without N+1:** GET `/equipment/:id` uses include: `{ tests: { select: {...} } }`,
  which Prisma runs as two queries total, not one per test. Use select to return only needed columns.
- **Filter, sort, paginate:** where from query params, whitelisted sort fields, skip/take, limit
  capped at 50 by zod (a request for `limit=100000` returns 422). The response includes
  `meta: { page, limit, total, totalPages }`. Indexes on `equipmentId`, `(userId, updatedAt)` and
  `(sessionId, createdAt)` back these queries.
- **Where the code waits on I/O:** Prisma calls, `bcrypt.hash` and `bcrypt.compare` (native
  async, thread pool), file uploads via streams. Everything uses async/await, so the event
  loop keeps serving other users.
- **Blocking calls:** none in request handlers. `readFileSync` is acceptable only at startup
  (loading a seed JSON before the server listens); say so if you use it. Never hash passwords
  with a sync API (`hashSync`).

## 2.10 Key code

- **`src/app.js`** (this file is your Q1 demo)
  ```javascript
  const app = express();
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.FRONTEND_ORIGIN.includes(origin)),
    credentials: true,
  }));
  app.use('/api', globalLimiter);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/v1', v1Router);
  app.use(notFound);
  app.use(errorHandler);
  export default app;
  ```

- **`src/db/prisma.js`**
  ```javascript
  import { PrismaClient } from '@prisma/client';
  import { env } from '../config/env.js';

  const g = globalThis;
  export const prisma = g.__prisma ?? new PrismaClient({
    log: env.LOG_QUERIES ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
  if (env.NODE_ENV !== 'production') g.__prisma = prisma;
  ```

- **`src/utils/AppError.js`** and **`src/middleware/error.js`**
  ```javascript
  export class AppError extends Error {
    constructor(status, code, message, details) {
      super(message);
      Object.assign(this, { status, code, details });
    }
  }

  export function errorHandler(err, req, res, next) {
    let status = 500, code = 'INTERNAL', message = 'Something went wrong', details;
    if (err.name === 'ZodError') {
      status = 422; code = 'VALIDATION_ERROR';
      message = 'Invalid input';
      details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    } else if (err.code === 'P2002') { status = 409; code = 'CONFLICT'; message = 'Already exists';
    } else if (err.code === 'P2025') { status = 404; code = 'NOT_FOUND'; message = 'Not found';
    } else if (err.type === 'entity.parse.failed') { status = 400; code = 'BAD_JSON'; message = 'Malformed JSON';
    } else if (err.type === 'entity.too.large') { status = 413; code = 'TOO_LARGE'; message = 'Body too large';
    } else if (err.status) { status = err.status; code = err.code; message = err.message; details = err.details; }
    if (status === 500) req.log?.error(err);
    else if (env.NODE_ENV !== 'production' && status === 500) message = err.message;
    res.status(status).json({ error: { code, message, details, requestId: req.id } });
  }
  ```

- **`src/middleware/validate.js`**
  ```javascript
  export const validate = (s) => (req, res, next) => {
    if (s.params) req.params = s.params.parse(req.params);
    if (s.query) req.validatedQuery = s.query.parse(req.query);
    if (s.body) req.body = s.body.parse(req.body);
    next();
  };
  ```

- **`src/middleware/rateLimit.js`**
  ```javascript
  const body = (msg) => ({ error: { code: 'RATE_LIMITED', message: msg } });
  const base = { standardHeaders: 'draft-7', legacyHeaders: false };
  export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 300, message: body('Too many requests') });
  export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10, message: body('Too many login attempts') });
  export const chatLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 20, keyGenerator: (req) => req.user.id, message: body('Slow down') });
  ```

- **`src/services/auth.service.js`** (login, refresh rotation, logout)
  ```javascript
  const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const cookieOpts = {
    httpOnly: true, path: '/api/v1/auth',
    secure: env.NODE_ENV === 'production', sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  };

  async function issue(user, res) {
    const access = jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
    const refresh = crypto.randomBytes(48).toString('hex');
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha(refresh), expiresAt: new Date(Date.now() + cookieOpts.maxAge) },
    });
    res.cookie('refresh_token', refresh, cookieOpts);
    return access;
  }

  async function login(email, password, res) {
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');
    return { accessToken: await issue(user, res), user: publicUser(user) };
  }

  async function refresh(raw, res) {
    if (!raw) throw new AppError(401, 'NO_REFRESH', 'Login required');
    const rec = await prisma.refreshToken.findUnique({ where: { tokenHash: sha(raw) }, include: { user: true } });
    if (!rec || rec.expiresAt < new Date()) throw new AppError(401, 'INVALID_REFRESH', 'Session expired');
    if (rec.revokedAt) {
      await prisma.refreshToken.updateMany({ where: { userId: rec.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new AppError(401, 'TOKEN_REUSE', 'Session revoked');
    }
    await prisma.refreshToken.update({ where: { id: rec.id }, data: { revokedAt: new Date() } });
    return { accessToken: await issue(rec.user, res) };
  }

  async function logout(raw, res) {
    if (raw) await prisma.refreshToken.updateMany({ where: { tokenHash: sha(raw), revokedAt: null }, data: { revokedAt: new Date() } });
    res.clearCookie('refresh_token', { ...cookieOpts, maxAge: undefined });
  }
  ```

- **`src/middleware/csrf.js`** (apply to refresh and logout)
  ```javascript
  export const requireCsrfHeader = (req, res, next) => {
    if (req.get('X-Requested-With') !== 'XMLHttpRequest') throw new AppError(403, 'CSRF', 'Missing CSRF header');
    next();
  };
  ```

- **`src/services/tests.service.js`** (list with filter, sort, pagination, no N+1)
  ```javascript
  export const listQuery = z.object({
    equipmentId: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(['name', 'createdAt']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });

  export async function listTests(q) {
    const where = {
      ...(q.equipmentId && { equipmentId: q.equipmentId }),
      ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
    };
    const [items, total] = await prisma.$transaction([
      prisma.test.findMany({
        where, orderBy: { [q.sort]: q.order }, skip: (q.page - 1) * q.limit, take: q.limit,
        select: { id: true, name: true, acceptableLimit: true, equipment: { select: { id: true, name: true } } },
      }),
      prisma.test.count({ where }),
    ]);
    return { items, meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) } };
  }
  ```

**Ownership check in the chat service:**
```javascript
const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: user.id } });
if (!session) throw new AppError(404, 'NOT_FOUND', 'Session not found');
```

## 2.11 Setup, deployment and tests

```bash
cd backend && npm install
cp .env.example .env          # fill secrets, especially DATABASE_URL and JWT_SECRET
createdb substationiq
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                   # http://localhost:4000/api/v1/health
```

**Deploy:** Postgres on Neon or Render; API on Render (build `npm install && npx prisma generate`, pre-deploy `npx prisma migrate deploy`, start `npm start`); frontend on Vercel with root `frontend` and `VITE_API_URL`. Add the Vercel origin to `FRONTEND_ORIGIN`.

**Tests (supertest):**
- register 201 then 409; invalid email 422; login 200; wrong password 401; `/auth/me` without token 401; USER on admin route 403; user A on user B's session 404; refresh rotates and the old token fails; login 11 times gives 429; pagination limit=1000 gives 422; seed twice leaves one admin.

## 2.12 Build plan

| Step | Deliverable | Covers |
|---|---|---|
| 1 | Project skeleton, env validation, Prisma schema, first migration, seed | Q5 |
| 2 | Middleware stack, error handler, validate, request id | Q1, Q2 |
| 3 | Auth: register, login, refresh, logout, roles | Q3 |
| 4 | Rate limits, helmet, CORS, CSRF header, sanitising | Q4 |
| 5 | Equipment, tests list endpoint, chat sessions and chat | Q1, Q2, Q5 |
| 6 | Tests, README rewrite, ER diagram, Postman collection | All |
| 7 | Deploy, then record the video | All |

## 2.13 Documentation to update before submission

- Rewrite README, PRD.md and TRD.md for Node, Express, Prisma and PostgreSQL. Remove the old Python performance numbers (100% intent accuracy, about 330 ms latency), because they came from a different backend. Add an ER diagram, the endpoint table, a Postman collection file and the setup steps from section 2.11.