# DB.md — SubstationIQ data evidence pack (Day 1–2)

This document captures the existing SQLite-backed data model and a small set
of real queries the application runs today, so the DBMS evidence in the
RUBRIC_CHECKLIST has concrete artifacts to point at.

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

## Notes

- The catalog schema and content are not touched this sprint; only the
  pagination/filtering/sorting convention on `GET /catalog/tests` is added
  (Day 2 B) via the shared `ListingParams` dependency.
- MongoDB collections added on Day 3+ live in `app/db/mongo_repos.py` and are
  documented separately in the MongoDB design section once they are wired up.
