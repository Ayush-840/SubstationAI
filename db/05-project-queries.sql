\echo 'Q01 — Current record counts'
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM equipment) AS equipment,
  (SELECT COUNT(*) FROM tests) AS tests,
  (SELECT COUNT(*) FROM documents) AS documents,
  (SELECT COUNT(*) FROM chat_sessions) AS chat_sessions,
  (SELECT COUNT(*) FROM messages) AS messages;

\echo 'Q02 — Safe admin lookup for authentication demo (no password hash selected)'
SELECT name, email, role
FROM users
WHERE role = 'ADMIN'
ORDER BY email;

\echo 'Q03 — Browse equipment alphabetically'
SELECT name, description
FROM equipment
ORDER BY name;

\echo 'Q04 — Read equipment and its related tests (main relationship join)'
SELECT e.name AS equipment, t.name AS test, t.limits
FROM equipment AS e
JOIN tests AS t ON t."equipmentId" = e.id
ORDER BY e.name, t.name
LIMIT 10;

\echo 'Q05 — Search procedure names for transformer-related tests'
SELECT e.name AS equipment, t.name AS test
FROM tests AS t
JOIN equipment AS e ON e.id = t."equipmentId"
WHERE e.name ILIKE '%transformer%'
ORDER BY e.name, t.name;

\echo 'Q06 — Search test names and aliases for megger/IR procedures'
SELECT e.name AS equipment, t.name AS test
FROM tests AS t
JOIN equipment AS e ON e.id = t."equipmentId"
WHERE t.name ILIKE '%IR%'
   OR EXISTS (
     SELECT 1
     FROM unnest(t.aliases) AS a(alias)
     WHERE a.alias ILIKE '%megger%'
   )
ORDER BY e.name, t.name;

\echo 'Q07 — Aggregate: number of tests per equipment'
SELECT e.name AS equipment, COUNT(t.id) AS test_count
FROM equipment AS e
LEFT JOIN tests AS t ON t."equipmentId" = e.id
GROUP BY e.id, e.name
ORDER BY test_count DESC, e.name;

\echo 'Q08 — HAVING: equipment with at least two procedures'
SELECT e.name AS equipment, COUNT(t.id) AS test_count
FROM equipment AS e
JOIN tests AS t ON t."equipmentId" = e.id
GROUP BY e.id, e.name
HAVING COUNT(t.id) >= 2
ORDER BY test_count DESC, e.name;

\echo 'Q09 — Subquery: equipment whose test count is above the average per equipment'
SELECT e.name AS equipment, COUNT(t.id) AS test_count
FROM equipment AS e
LEFT JOIN tests AS t ON t."equipmentId" = e.id
GROUP BY e.id, e.name
HAVING COUNT(t.id) > (
  SELECT AVG(per_equipment.test_count)
  FROM (
    SELECT COUNT(*) AS test_count
    FROM tests
    GROUP BY "equipmentId"
  ) AS per_equipment
)
ORDER BY test_count DESC, e.name;

\echo 'Q10 — Document ingestion status dashboard (empty until PDFs are uploaded)'
SELECT status, COUNT(*) AS document_count
FROM documents
GROUP BY status
ORDER BY status;

\echo 'Q11 — Chat activity per user (left joins keep users with no sessions)'
SELECT u.email, COUNT(DISTINCT s.id) AS sessions, COUNT(m.id) AS messages
FROM users AS u
LEFT JOIN chat_sessions AS s ON s."userId" = u.id
LEFT JOIN messages AS m ON m."sessionId" = s.id
GROUP BY u.id, u.email
ORDER BY u.email;

\echo 'Q12 — INSERT, UPDATE, DELETE demo; all changes are rolled back at the end'
BEGIN;
INSERT INTO equipment (id, name, description)
VALUES (gen_random_uuid()::text, 'DE Viva Temporary Equipment', 'Temporary CRUD demonstration row')
RETURNING id, name \gset viva_insert_
\echo Inserted temporary row: :viva_insert_name (id :viva_insert_id)

UPDATE equipment
SET description = 'Updated inside the demonstration transaction'
WHERE id = :'viva_insert_id'
RETURNING name, description;

DELETE FROM equipment
WHERE id = :'viva_insert_id'
RETURNING name;
ROLLBACK;
\echo 'The CRUD demo transaction was rolled back; no demonstration row remains.'

\echo 'Q13 — UNIQUE constraint demonstration (expected rejection; no row is added)'
DO $$
DECLARE existing_name text;
BEGIN
  SELECT name INTO existing_name FROM equipment ORDER BY name LIMIT 1;
  BEGIN
    INSERT INTO equipment (id, name)
    VALUES (gen_random_uuid()::text, existing_name);
    RAISE EXCEPTION 'Expected the equipment name UNIQUE constraint to reject this insert';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Expected result: duplicate equipment name rejected by UNIQUE constraint';
  END;
END $$;

\echo 'Q14 — Foreign-key validation demonstration (expected rejection; no row is added)'
DO $$
BEGIN
  BEGIN
    INSERT INTO tests (id, "equipmentId", name, aliases, steps, safety, tools)
    VALUES (
      gen_random_uuid()::text,
      '00000000-0000-0000-0000-000000000000',
      'DE invalid FK demonstration',
      ARRAY[]::text[], ARRAY['Temporary invalid relation test'],
      ARRAY[]::text[], ARRAY[]::text[]
    );
    RAISE EXCEPTION 'Expected the equipment foreign key to reject this insert';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'Expected result: test rejected because its equipment row does not exist';
  END;
END $$;

\echo 'Q15 — Existing indexes supporting unique lookups and primary keys'
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'equipment', 'tests', 'chat_sessions', 'messages')
ORDER BY tablename, indexname;
