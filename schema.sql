-- SubstationIQ: reference PostgreSQL schema (DDL)
-- Alembic migrations are the source of truth in the running app;
-- this file is the human-readable DDL submitted as evidence for the SQL rubric.
-- Requires PostgreSQL 15+ and the pgvector extension.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------- Enumerated types ----------
CREATE TYPE user_role      AS ENUM ('trainee', 'engineer', 'admin');
CREATE TYPE test_category  AS ENUM ('routine', 'diagnostic', 'commissioning');
CREATE TYPE record_status  AS ENUM ('draft', 'verified');
CREATE TYPE step_type      AS ENUM ('safety', 'prep', 'action', 'record');
CREATE TYPE standard_body  AS ENUM ('IEC', 'IEEE', 'IS', 'CBIP', 'CEA', 'OEM', 'OTHER');
CREATE TYPE doc_type       AS ENUM ('manual', 'sop', 'standard', 'guideline', 'checklist');
CREATE TYPE doc_status     AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE run_status     AS ENUM ('in_progress', 'completed', 'aborted');
CREATE TYPE synonym_kind   AS ENUM ('test', 'equipment', 'parameter', 'abbreviation');
CREATE TYPE safety_scope   AS ENUM ('general', 'equipment', 'test');

-- ---------- Users and sessions ----------
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL,
    email          VARCHAR(255)  NOT NULL UNIQUE,
    password_hash  VARCHAR(255)  NOT NULL,
    role           user_role     NOT NULL DEFAULT 'trainee',
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id           SERIAL PRIMARY KEY,
    user_id      INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   CHAR(64)    NOT NULL UNIQUE,      -- SHA-256 of the token; raw token never stored
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

-- ---------- Domain: equipment, documents, sources, standards ----------
CREATE TABLE equipment_classes (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(80)  NOT NULL UNIQUE,     -- e.g. Power Transformer
    slug         VARCHAR(80)  NOT NULL UNIQUE,
    description  TEXT
);

CREATE TABLE documents (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(200) NOT NULL,
    filename            VARCHAR(255) NOT NULL,
    doc_type            doc_type     NOT NULL,
    equipment_class_id  INT REFERENCES equipment_classes(id) ON DELETE SET NULL,
    status              doc_status   NOT NULL DEFAULT 'processing',
    page_count          INT          CHECK (page_count >= 0),
    uploaded_by         INT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE sources (                              -- a citable location (document, page, section)
    id              SERIAL PRIMARY KEY,
    document_id     INT REFERENCES documents(id) ON DELETE SET NULL,
    reference_text  VARCHAR(300) NOT NULL,          -- human-readable citation
    page            INT CHECK (page > 0),
    section         VARCHAR(200)
);

CREATE TABLE standards (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(60)   NOT NULL UNIQUE,
    title       VARCHAR(250)  NOT NULL,
    body        standard_body NOT NULL,
    scope_note  TEXT
);

CREATE TABLE instruments (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL UNIQUE,
    description  TEXT
);

-- ---------- Domain: test catalog ----------
CREATE TABLE tests (
    id                  SERIAL PRIMARY KEY,
    equipment_class_id  INT           NOT NULL REFERENCES equipment_classes(id) ON DELETE RESTRICT,
    name                VARCHAR(150)  NOT NULL,
    slug                VARCHAR(150)  NOT NULL,
    category            test_category NOT NULL,
    purpose             TEXT          NOT NULL,
    frequency_note      TEXT,
    status              record_status NOT NULL DEFAULT 'draft',
    created_by          INT REFERENCES users(id) ON DELETE SET NULL,
    verified_by         INT REFERENCES users(id) ON DELETE SET NULL,
    verified_at         TIMESTAMPTZ,
    UNIQUE (equipment_class_id, slug),
    CHECK (status = 'draft' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE TABLE test_steps (
    id         SERIAL PRIMARY KEY,
    test_id    INT       NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    step_no    INT       NOT NULL CHECK (step_no > 0),
    step_type  step_type NOT NULL,
    text       TEXT      NOT NULL,
    source_id  INT REFERENCES sources(id) ON DELETE SET NULL,
    UNIQUE (test_id, step_no)
);

CREATE TABLE test_instruments (                     -- N:N tests <-> instruments
    test_id        INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    instrument_id  INT NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    spec_note      VARCHAR(200),
    PRIMARY KEY (test_id, instrument_id)
);

CREATE TABLE test_standards (                       -- N:N tests <-> standards
    test_id      INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    standard_id  INT NOT NULL REFERENCES standards(id) ON DELETE RESTRICT,
    clause_note  VARCHAR(200),
    PRIMARY KEY (test_id, standard_id)
);

CREATE TABLE test_limits (
    id              SERIAL PRIMARY KEY,
    test_id         INT           NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    parameter       VARCHAR(120)  NOT NULL,
    min_value       NUMERIC(14,4),
    max_value       NUMERIC(14,4),
    criterion_text  TEXT,                            -- for qualitative limits
    unit            VARCHAR(30),
    condition_note  TEXT,                            -- voltage class, temperature correction, new/in-service
    standard_id     INT REFERENCES standards(id) ON DELETE SET NULL,
    source_id       INT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,   -- every limit must be sourced
    CHECK (min_value IS NOT NULL OR max_value IS NOT NULL OR criterion_text IS NOT NULL),
    CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE TABLE safety_precautions (
    id                  SERIAL PRIMARY KEY,
    scope               safety_scope NOT NULL,
    equipment_class_id  INT REFERENCES equipment_classes(id) ON DELETE CASCADE,
    test_id             INT REFERENCES tests(id) ON DELETE CASCADE,
    text                TEXT    NOT NULL,
    mandatory           BOOLEAN NOT NULL DEFAULT TRUE,
    source_id           INT REFERENCES sources(id) ON DELETE SET NULL,
    CHECK (
        (scope = 'general'   AND equipment_class_id IS NULL     AND test_id IS NULL) OR
        (scope = 'equipment' AND equipment_class_id IS NOT NULL AND test_id IS NULL) OR
        (scope = 'test'      AND test_id IS NOT NULL)
    )
);

CREATE TABLE troubleshooting (
    id                  SERIAL PRIMARY KEY,
    test_id             INT  NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    symptom             TEXT NOT NULL,
    probable_cause      TEXT NOT NULL,
    recommended_action  TEXT NOT NULL,
    source_id           INT REFERENCES sources(id) ON DELETE SET NULL
);

CREATE TABLE synonyms (
    id         SERIAL PRIMARY KEY,
    canonical  VARCHAR(120) NOT NULL,               -- e.g. insulation resistance
    variant    VARCHAR(120) NOT NULL,               -- e.g. megger test
    kind       synonym_kind NOT NULL,
    UNIQUE (variant, kind)
);

-- ---------- Retrieval chunks (RAG) ----------
CREATE TABLE chunks (
    id                  BIGSERIAL PRIMARY KEY,
    document_id         INT  NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index         INT  NOT NULL,
    page_start          INT,
    page_end            INT,
    section_title       VARCHAR(200),
    content             TEXT NOT NULL,
    embedding           vector(384),                 -- bge-small-en-v1.5
    tsv                 tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    equipment_class_id  INT REFERENCES equipment_classes(id) ON DELETE SET NULL,
    test_id             INT REFERENCES tests(id) ON DELETE SET NULL,
    UNIQUE (document_id, chunk_index)
);

-- ---------- Guided procedure runs ----------
CREATE TABLE procedure_runs (
    id            SERIAL PRIMARY KEY,
    user_id       INT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    test_id       INT        NOT NULL REFERENCES tests(id) ON DELETE RESTRICT,
    status        run_status NOT NULL DEFAULT 'in_progress',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    notes         TEXT,
    CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE TABLE procedure_run_steps (
    id          SERIAL PRIMARY KEY,
    run_id      INT NOT NULL REFERENCES procedure_runs(id) ON DELETE CASCADE,
    step_id     INT NOT NULL REFERENCES test_steps(id) ON DELETE RESTRICT,
    checked     BOOLEAN NOT NULL DEFAULT FALSE,
    checked_at  TIMESTAMPTZ,
    note        TEXT,
    UNIQUE (run_id, step_id),
    CHECK (checked = FALSE OR checked_at IS NOT NULL)
);

-- ---------- Retrieval speed-ups (optional; performance topics are not graded) ----------
CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX chunks_tsv_idx       ON chunks USING gin (tsv);
