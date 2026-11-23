# SubstationAI — Data Engineering Project

This folder contains the database design, normalization notes, diagrams, real sample data, project-specific SQL operations, and backend integration evidence for the SubstationAI project.

## Database choice

The application uses PostgreSQL with Prisma. The local demo database is `substationai`; the backend can also connect to a PostgreSQL service such as Neon by changing `backend/.env`.

## Contents

- `01-database-choice.md` — data characteristics, workload, consistency needs, and MongoDB comparison.
- `02-schema-and-relationships.md` — entities, attributes, keys, and relationship cardinalities.
- `03-normalization.md` — 1NF, 2NF, 3NF/BCNF reasoning and deliberate array/JSON choices.
- `04-sample-data.md` — current local row counts and representative records.
- `05-project-queries.sql` — 15 project-specific queries/operations; the write demo rolls back.
- `06-query-results.txt` — output captured from the local PostgreSQL database.
- `07-backend-integration.md` — routes, controllers, Prisma and application data flow.
- `diagrams/erd.mmd` and `diagrams/erd.svg` — editable ER diagram source and presentation-ready image.
- `diagrams/architecture.mmd` — frontend-to-database architecture diagram source.

## Inspect the design

From the repository root, open the schema and rendered ER diagram:

```sh
code backend/prisma/schema.prisma db/diagrams/erd.svg
```

The SVG is presentation-ready and zoomable. Its editable Mermaid source is `diagrams/erd.mmd`.

## Run the SQL demonstrations

From the repository root, connect to the local database without printing the `.env` values:

```sh
cd backend
set -a
source .env
set +a
psql "$DATABASE_URL"
```

At the `substationai=>` prompt, run:

```psql
\i ../db/05-project-queries.sql
```

The script is designed for the project database. It reads current rows, demonstrates INSERT/UPDATE/DELETE inside a transaction, then rolls those demo writes back. It also catches and reports expected UNIQUE and foreign-key violations without leaving test rows behind.

To run the Prisma-backed query demo instead, use the backend’s Prisma Client controllers described in `07-backend-integration.md`.

## Evidence and scope

The query-results file was captured against the local PostgreSQL database. It reports 1 user, 8 equipment records, and 20 tests. There are no seeded documents, sessions, or messages yet, so queries for those tables correctly return empty results. The write example is rolled back and invalid-row examples are caught, leaving seed counts unchanged. The `vector(768)` column is reserved for future work; current AI and ingestion modules are stubs and do not run RAG queries.
