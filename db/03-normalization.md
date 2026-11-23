# 3. Normalization notes

## Starting point and anomalies

A flat project spreadsheet could put user details, equipment name, every test, the full list of test steps, chat session title, and messages in the same row. Repeating tests or messages would duplicate user/equipment details. Updating an equipment name could leave inconsistent copies (update anomaly); deleting the last test row could accidentally remove the only copy of equipment details (delete anomaly); inserting an equipment type before it has tests would be awkward (insert anomaly).

## 1NF transformation

Separate repeating entity groups into one row per user, equipment, test, document, session, and message. Give each row a primary key and store foreign keys on the many side. To achieve strict scalar 1NF for every procedure list, aliases, steps, tools, and safety notes would each be child rows (for example, `test_steps(test_id, step_no, text)`). The current implementation instead stores those collections as PostgreSQL arrays because they are normally read as one procedure. Consequently, the full physical schema is pragmatic and not strictly scalar 1NF. `Message.sources` is JSON for the same flexible-payload reason.

## 2NF transformation

There are no composite primary keys in the current schema; every entity uses a single UUID key. Therefore, there can be no dependency on only part of a composite key. If procedure steps were normalized into a child table, its key could be `(test_id, step_no)`, and the step text would depend on the whole key.

## 3NF / BCNF reasoning

For `User`, the functional dependencies are:

- `id → name, email, password, role, createdAt`
- `email → id, name, password, role, createdAt` because email is unique.

For `Equipment`, `id → name, description` and `name → id, description` because name is unique. Each determinant is a candidate key, so these scalar relations meet BCNF. Partial dependencies are absent because the primary key is a single ID. Transitive dependencies are reduced by storing equipment attributes in `equipment` and storing only `equipmentId` in `tests`; similarly, messages store `sessionId`, not a duplicated user profile.

## Deliberate derived value

`ChatSession.title` can be derived from the first question. `backend/src/services/chat.js` checks for the default title and updates it with a 60-character shortened version of the question. The full question remains in `messages`, which is the canonical record. This is a small display-oriented derivation, not a second copy of the full message. Concurrent first messages could race to set the title; the current code does not use a row lock for that update.

In summary: the scalar relational core is in 3NF/BCNF under its declared keys; arrays and JSON are intentional collection fields, so the entire physical schema is not claimed to be strict 1NF.
