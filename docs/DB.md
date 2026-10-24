# DB.md — SubstationIQ data evidence pack (Day 1–5)

This document captures the existing SQLite-backed data model, a small set
of real queries the application runs today, and the MongoDB design added on
Days 3–4, so the DBMS evidence in the RUBRIC_CHECKLIST has concrete
artifacts to point at.

## ER Diagram

![ER Diagram](er-diagram.png)

*The ER diagram can be generated from the SQLAlchemy models using a tool like `eralchemy` or drawn manually in dbdiagram.io / draw.io. The image file `er-diagram.png` should be placed in this directory.*

## OpenAPI Specification

The full OpenAPI 3.0 specification is available at [`../docs/openapi.json`](../docs/openapi.json) and served at `/docs` (Swagger UI) and `/redoc` (ReDoc) when the backend is running.

## Data dictionary (existing SQLAlchemy models)

Key tables in `backend/app/db/models.py`:

- `users` — `id, name, email, password_hash, role (user|admin), created_at`
- `equipment_classes` — `id, name, aliases, description`
- `tests` — `id, equipment_class_id, name, aliases, category, purpose, frequency_note, summary`
- `test_limits` — `id, test_id, parameter, value_text, min_val, max_val, unit, condition_note`
- `test_steps` — `id, test_id, step_no, step_type, text, source_id`
- `test_equipment` — `id, test_id, instrument_name, spec_note, source_id`
- `test_standards` — `id, test_id, standard_id, clause_note`
- `safety_precautions` — `id, scope, equipment_class_id, test_id, text, mandatory, source_id`
- `troubleshooting` — `id, test_id, symptom, probable_cause, recommended_action, source_id`
- `standards` — `id, code, title, body (enum), scope_note`
- `documents` — `id, title, filename, doc_type, equipment_class_id, standard_id, version, status, uploaded_by, page_count, created_at`
- `chunks` — `id, document_id, page_start, page_end, section_title, text, equipment_class_id, test_id, chunk_index, token_count`
- `sources` — `id, document_id, page, section, url_or_ref`
- `conversations` — `id, user_id, title, mode, created_at`
- `messages` — `id, conversation_id, role, content, intent, entities_json, citations_json, confidence, latency_ms, created_at`
- `feedback` — `id, message_id, user_id, rating, comment, created_at`
- `procedure_runs` — `id, user_id, test_id, steps_state_json, notes, started_at, completed_at`

## Real queries — existing app behavior

These are the queries the FastAPI endpoints execute today. They are intended
to be read and explained as evidence; they are not new.

### Q1 — Join across catalog tables (TestDetail)

`GET /api/catalog/tests/{test_id}` assembles a full test record by joining
`tests → test_steps → test_equipment → test_limits → test_standards → safety_precautions → troubleshooting` in a single
catalog-lookup call.

### Q2 — Filter by equipment class (catalog list)

`GET /api/catalog/tests?equipment=Circuit Breaker` → `CatalogLookup.find_equipment(name)` looks up the equipment class,
then `get_tests_for_equipment(equip.id)` returns every test joined to that
equipment class.

### Q3 — GROUP BY / HAVING (feedback rating average)

`POST /api/feedback` stores one rating per message. The admin analytics
endpoint (`GET /api/admin/analytics`) aggregates ratings across messages to
produce `avg_rating` and the unanswered-query rate — a GROUP BY-style
aggregation over `feedback` and `unanswered_queries`.

### Q4 — Subquery/CTE-style chat history fetch

`GET /api/chat/conversations/{cid}` loads the conversation header and its
messages in one flow: it filters `conversations` by `id + user_id` (ownership
check) and then pulls the ordered message set for that conversation — the
ownership filter acts as a subquery restriction on the chat history.

### Q5 — Existence check used by feedback upsert

`POST /api/feedback` first checks whether a feedback row already exists for
`(message_id, user_id)` — an existence subquery — and upserts in place rather
than inserting a duplicate rating.

## MongoDB design (Day 3–4)

MongoDB is a secondary store for chat history — with one exception:
**`fault_logs` has no SQLite table, so MongoDB is the system of record for
fault diagnoses.** SQLite remains the source of truth for users, catalog,
messages and procedure runs, which is why every mirrored document carries
`sql_id` and every Mongo-backed endpoint falls back to SQLite when the probe
in `app/db/mongo.py` reports the server unreachable (1.5 s server-selection
timeout, 30 s retry backoff — MongoDB can be down without taking the API
down). Indexes are created at startup in `ensure_indexes()`.

### Collection shapes (TRD §3.1)

| Collection | Shape | Notes |
|---|---|---|
| `conversations` | `{_id, sql_id, user_id, title, mode, equipment, created_at, updated_at}` | header only, so the history list stays a cheap paged read |
| `messages` | `{_id, conversation_id, sql_id, role, content, intent, entities, citations[], confidence, created_at}` | `conversation_id` is an ObjectId reference; citations are embedded |
| `feedback` | `{_id, message_id, user_id, rating, comment, created_at}` | `message_id` is an ObjectId reference to `messages._id` |
| `fault_logs` | `{_id, user_id, equipment_class, symptoms[], readings{}, diagnosis, resolution, logged_at}` | no SQLite counterpart |

Indexes: `conversations.sql_id`, `(user_id, created_at)`; `messages.sql_id`,
`conversation_id`; unique `(message_id, user_id)` on `feedback`;
`(user_id, logged_at)` on `fault_logs`.

### Embed vs. reference — why each relationship looks the way it does

| Relationship | Choice | Justification |
|---|---|---|
| conversation → messages | **reference** (`messages.conversation_id` → `conversations._id`) | a conversation can hold hundreds of messages, but the history list only reads the header (`title`, `updated_at`, `message_count`); embedding would make every list read carry message bodies nobody asked for |
| message → citations | **embed** (`citations[]` inside the message) | citations are always displayed with their message and are never queried or updated alone — one read returns everything; a separate collection would cost a second round trip for data that is always read together |
| message → feedback | **reference** (`feedback.message_id` → `messages._id`) | a vote is written and read by `(message, user)`, never as part of the message body; the separate collection lets the unique index on `(message_id, user_id)` be the one-vote rule, keeps "my votes" queries narrow, and makes the `$lookup` below aggregate across messages without touching message text |
| fault diagnosis → readings | **embed** (`readings{}` map + `symptoms[]`) | readings vary completely by equipment (ppm vs. kV vs. µΩ); a fixed column set would need a migration per equipment type, and both fields are only ever read together with the log |
| mirrored docs ↔ SQLite rows | **bridge field** (`sql_id`) | ids the API already handed out (eval harness, frontend) keep resolving while SQLite stays authoritative: repositories translate `sql_id` ↔ ObjectId at the boundary in `to_object_id()` (`app/db/mongo_repos.py`), never in an endpoint |

### Sample documents (mongosh format)

```js
// conversations — header only, sql_id bridges to the SQLite row
{
  _id: ObjectId("652f1c8a9d3b2e77c1a40001"),
  sql_id: 41,
  user_id: 2,
  title: "Contact resistance limits?",
  mode: "qa",
  equipment: "Circuit Breaker",
  created_at: ISODate("2026-10-16T10:12:03Z"),
  updated_at: ISODate("2026-10-16T10:13:40Z")
}

// messages — citations embedded, conversation referenced by ObjectId
{
  _id: ObjectId("652f1d3b9d3b2e77c1a40002"),
  conversation_id: ObjectId("652f1c8a9d3b2e77c1a40001"),
  sql_id: 118,
  role: "assistant",
  content: "The acceptable contact resistance per pole is 50 µΩ …",
  intent: "limit",
  entities: { equipment: "Circuit Breaker" },
  citations: [
    { document: "CB Maintenance Manual", page: 12, section: "Contact resistance" }
  ],
  confidence: 0.86,
  created_at: ISODate("2026-10-16T10:12:04Z")
}

// feedback — message referenced as an ObjectId (see the $lookup note below)
{
  _id: ObjectId("652f20119d3b2e77c1a40003"),
  message_id: ObjectId("652f1d3b9d3b2e77c1a40002"),
  user_id: 2,
  rating: -1,
  comment: "answer missed the CT ratio",
  created_at: ISODate("2026-10-16T10:14:11Z")
}

// fault_logs — free-form readings embedded, no SQLite counterpart
{
  _id: ObjectId("652f30449d3b2e77c1a40004"),
  user_id: 2,
  equipment_class: "Power Transformer",
  symptoms: ["oil temperature rising", "moisture high dew point"],
  readings: { free_text: "H2 = 145 ppm, tan delta = 1.9%" },
  diagnosis: "[DGA] Gas ratio indicates thermal fault …",
  resolution: "Sample oil and retest after 48h",
  logged_at: ISODate("2026-10-16T11:02:55Z")
}
```

### `$lookup` example — feedback joined back to message content

Find every down-voted answer together with the text that was voted on:

```js
db.feedback.aggregate([
  { $match: { rating: -1 } },
  { $lookup: {
      from: "messages",
      localField: "message_id",   // ObjectId
      foreignField: "_id",        // ObjectId — BSON types must match exactly
      as: "message"
  } },
  { $unwind: "$message" },
  { $project: {
      rating: 1, comment: 1, user_id: 1,
      sql_id: "$message.sql_id",
      question: "$message.content"
  } }
])
```

**ObjectId type-match caution (TRD §3.1):** `$lookup` compares BSON types
exactly. `feedback.message_id` is converted with `to_object_id()` inside
`FeedbackRepo` before **every** write — if it were ever stored as a plain
string (e.g. `"118"` for a SQLite id, or `"652f1d3b…"` for an ObjectId),
the `localField` (string) would never equal the `foreignField` (ObjectId)
and the join would silently return `message: []` for every row: no error,
no counts, just empty aggregates. The repository also verifies the id
against `messages` first, so a vote cannot reference a message that is not
mirrored. `messages.conversation_id` follows the same rule via
`MessageRepo`.

## Notes

- The catalog schema and content are not touched this sprint; only the
  pagination/filtering/sorting convention on `GET /catalog/tests` is added
  (Day 2 B) via the shared `ListingParams` dependency.
- `POST /api/feedback` now writes MongoDB first (Day 4 B); the SQLite
  `feedback` row is kept as a best-effort mirror because the admin analytics
  aggregation (Q3) still reads it, and it is the only store while MongoDB
  is unreachable.
- Repository contracts are tested without a live server via the in-memory
  double in `backend/tests/mongo_fakes.py`; Day 5 B extends that suite.
