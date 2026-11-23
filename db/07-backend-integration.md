# 7. Backend integration evidence

## Data path

`frontend` sends HTTP requests to Express routes. Routes apply authentication/role middleware and call controllers. Controllers validate input with Zod and use the shared Prisma client in `backend/src/db.js`. Prisma maps model operations to PostgreSQL SQL; PostgreSQL constraints and foreign keys enforce persistence rules.

```text
React frontend
   │ HTTP /api requests
   ▼
Express routes → auth/role/validation middleware
   │
   ▼
Controllers → Prisma Client (backend/src/db.js)
   │ SQL
   ▼
PostgreSQL tables and constraints
```

## Concrete code paths to show

- Authentication: `backend/src/routes/auth.js` → `backend/src/controllers/auth.js` → `prisma.user.findUnique({ where: { email } })`; bcrypt compares the supplied password against the stored hash. API responses omit the password.
- Equipment/test reads: `backend/src/routes/equipment.js` → `backend/src/controllers/equipment.js`; queries use Prisma `findMany`, `findUnique`, and related test counts. `backend/src/controllers/tests.js` includes related equipment in test reads.
- Chat: `backend/src/controllers/chat.js` and `backend/src/services/chat.js` create sessions, verify session ownership, load message history, and persist messages.
- Documents: `backend/src/controllers/documents.js` creates document rows and updates ingestion status; `backend/src/services/documents.js` handles the stub workflow.
- Admin: `backend/src/controllers/admin.js` queries counts, lists users without password hashes, changes roles, and deletes users. PostgreSQL cascades related sessions/messages.
- Shared client: `backend/src/db.js` exports the PrismaClient instance; `backend/prisma/schema.prisma` is the data model.

## Correctness, transactions, and concurrent requests

- Database-enforced rules in the migration: primary keys on all tables, unique `users.email` and `equipment.name`, non-null columns, enum types for role/status/message role, and foreign keys with cascading deletes for tests, chunks, sessions, and messages.
- Application-level rules: Zod validates request shape and values in controllers; password strength and authentication checks are application logic. There are no custom SQL `CHECK` constraints in the current migration.
- Atomic multi-row example: the SQL demonstration in `05-project-queries.sql` runs INSERT, UPDATE, and DELETE within one explicit transaction and rolls it back. PostgreSQL rolls back all writes if a statement fails before commit. In the application, deleting a user is one SQL delete plus database FK cascades. Chat persistence is not atomic across generating and saving both messages: a failure after the user message can leave that message without an assistant reply.
- Concurrency: PostgreSQL defaults to `READ COMMITTED`; each statement sees committed rows as of that statement. The unique constraints arbitrate simultaneous duplicate email/equipment-name inserts, so only one succeeds. The application does not use explicit row locks or custom isolation levels. A duplicate seed test could race because `(equipmentId, name)` is not a unique constraint; seed currently runs sequentially.
- The SQL demo attempts a duplicate equipment name and a test with a nonexistent equipment ID. PostgreSQL rejects these through its unique and foreign-key constraints; exception blocks catch the expected errors so the script continues.

## Demonstrating UI-to-database persistence

Use the admin UI/API to create a new equipment item, then verify it in PostgreSQL:

```sql
SELECT id, name, description
FROM equipment
WHERE name = 'DE Viva Demo Equipment';
```

Update it in the application, rerun the SELECT to show the changed description, then delete it and rerun the SELECT to show zero rows. Use a dedicated demo row and do not perform this against production.

The local verification for this project exercised the backend health endpoint, admin login and access, engineer denial on admin routes, and a chat stream. The local seed contains equipment and test rows. Document ingestion and AI answers remain stubs; no RAG logic or vector queries are claimed as implemented.

## Query output and index evidence

Run the commands in `README.md` and then `\\i ../db/05-project-queries.sql` in `psql`. The captured output is in `06-query-results.txt`. It includes counts, joined equipment/test rows, aggregates, `HAVING`, a grouped-average subquery, rolled-back CRUD statements, expected constraint rejections, and `pg_indexes` output. Existing indexes support primary-key lookups and unique email/equipment-name lookups. No other index is currently declared.
