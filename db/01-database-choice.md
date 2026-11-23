# 1. Database selection and justification

## Selected database

SubstationAI uses **PostgreSQL**, a relational database, accessed by the Express backend through Prisma. The local demonstration uses PostgreSQL 18. The same Prisma schema can target a hosted PostgreSQL service; the backend README documents Neon-compatible setup.

## Data characteristics

The core entities are structured: users, equipment, tests, documents, chat sessions, and messages. Their relationships are mostly one-to-many: equipment has tests, a user has chat sessions, a session has messages, and a document has chunks. A few fields are flexible: procedure aliases, steps, tools, and safety notes are PostgreSQL arrays; message sources are JSON. The schema also declares a nullable `vector(768)` column for future use, but current code does not generate embeddings or run vector queries.

## Workload and expected size

Common reads include:

1. Find a user by unique email during login.
2. Browse equipment and tests, including equipment/test relationships.
3. List chat sessions for a user and load recent messages for a session.

Writes include user registration, admin-maintained equipment and tests, document status changes, and chat messages. The seeded local database contains 1 admin, 8 equipment records, and 20 tests. A reasonable initial pilot estimate is hundreds of engineers and thousands of chat messages; this is a planning assumption, not a benchmark. Documents and messages can grow over time, so they need pagination and indexes as usage grows.

## Consistency and transactions

The application needs reliable email uniqueness, valid foreign-key relationships, and consistent cascade behavior. PostgreSQL provides ACID transactions and constraint enforcement. In current code, individual SQL statements are atomic; the complete chat answer flow is not one transaction because the user message is written before answer generation and the assistant message afterwards. If answer generation fails, a user-only message can remain. Deleting a user is one database delete with foreign-key cascades to sessions and messages.

## Alternative considered

MongoDB is a plausible document-oriented alternative because a test procedure contains lists and a message can contain JSON sources. PostgreSQL was selected because the core data has stable relationships, uniqueness rules, foreign keys, and cascade behavior. With MongoDB, these cross-document rules would need additional application logic or transactions. MongoDB is not used by this project.

## Efficiency and growth

The schema has primary-key indexes and unique indexes on `users.email` and `equipment.name`. These support key lookups and enforce uniqueness. There are no declared indexes on foreign-key columns or message timestamps; with the current tiny seed, additional indexes would add write and storage cost without demonstrated benefit. For a larger workload, measure session-list, recent-message, equipment-test, and document-chunk queries with `EXPLAIN (ANALYZE, BUFFERS)` and add indexes based on those plans. Candidates include `(userId, createdAt)` for session lists, `(sessionId, createdAt)` for message history, and `equipmentId` for test reads.

The project does not currently shard or partition data. At 100 times the assumed usage, message/history queries and unbounded retention would likely be the first pressure points. I would instrument query latency, add measured composite indexes, keep pagination, define retention/archive policy, and scale PostgreSQL vertically or use a managed read replica for read-heavy traffic. Partition high-volume messages by time only after measuring table growth. Sharding is a later step because it complicates transactions and operations.
