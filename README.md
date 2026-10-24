# SubstationIQ

**An intelligent assistant for substation asset maintenance — test procedures, acceptable limits, troubleshooting, applicable standards, safety guidance and the test equipment to carry out each activity.**

| | |
|---|---|
| Problem statement | An intelligent chatbot to answer queries pertaining to various maintenance processes within a substation |
| Organising body | Ministry of Power |
| Year | 2023 |
| Category | Software |
| Domain bucket | Smart Education |

> SubstationIQ is an informational aid. It does not replace official utility procedures, OEM instructions, work permits or trained personnel. Sample content bundled in this repo is for demonstration only.

---

## Contents

- [Problem Statement](#problem-statement)
- [Our Solution](#our-solution)
- [Features](#features)
- [Equipment and Topics Covered](#equipment-and-topics-covered)
- [How an Answer Looks](#how-an-answer-looks)
- [Demo](#demo)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Evaluation](#evaluation)
- [API Overview](#api-overview)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Problem Statement

Substation asset maintenance covers a wide range of equipment — **transformers, reactors, circuit breakers, instrument transformers and surge arresters** among them. Keeping each of these healthy means carrying out tests and checks, and for every one of those there are documented **procedures and acceptable limits**.

What's missing is a friendly way to ask about them in plain language. A maintenance engineer should be able to type a question and immediately get:

- the **steps** to carry out a test,
- the **acceptable limits** and where they come from,
- what to **do when something is out of spec**, and
- the **standards, safety guidance and test equipment** behind the answer.

That is the gap SubstationIQ is built to close.

## Our Solution

SubstationIQ is a **retrieval-augmented, standards-aware assistant**. It reads a question, figures out what the user is really after — a procedure, a limit, a troubleshooting path, the equipment, a standard, or a safety note — then pulls the most relevant passages from a curated knowledge base of manuals, SOPs and standards. It answers in a **structured, cited format**, and it refuses to guess when the documents don't support an answer.

Two knowledge layers work together:

1. **Document knowledge (RAG).** Manuals, SOPs, guidelines and standards summaries, chunked, embedded and searchable semantically.
2. **A structured test catalog.** A curated registry of tests per equipment, with purpose, test equipment, safety precautions, steps, acceptable limits, standards and troubleshooting. Critical numbers — especially limits — come from verified records, not from free-form generation.

## Features

**Core — the parts that map directly to the problem statement**

- **Semantic query understanding.** Ask in natural language, with synonyms and abbreviations — *IR test*, *insulation resistance*, *megger test*; *PI*, *DGA*, *SFRA*, *tan delta*.
- **Intent detection.** Procedure, acceptable limits, troubleshooting, test equipment, standards, safety — understood and labelled.
- **Test procedures.** Step-by-step instructions for each maintenance test.
- **Acceptable limits and typical values.** Shown with the source and the standard they come from.
- **Issue resolution.** Probable causes and corrective actions for maintenance problems.
- **Industrial standards.** References such as IEC, IEEE, IS and CBIP/CEA guidance, with citations.
- **Safety guidelines.** Isolation, earthing, PPE and permit-to-work reminders appear on every relevant answer.
- **Test equipment.** The instruments required for each activity — insulation tester, winding resistance meter, tan delta kit, SFRA analyser, contact resistance meter, breaker analyser and the like.
- **Citations on every answer.** Document, page and section.
- **Honest "not found" behaviour.** A clear response when the knowledge base lacks reliable information.

**Supporting capabilities**

- Streaming chat with equipment filters.
- Guided Procedure Mode with mandatory safety confirmations and PDF export.
- Fault Diagnosis Mode: symptoms and readings leading to ranked probable causes.
- An admin panel to upload, tag and manage documents (PDF, DOCX, TXT).
- JWT authentication with **Trainee, Engineer and Admin roles** — fault diagnosis and DGA are Engineer+ (`require_role`), everyone owns their conversations, feedback and procedure runs; rotated refresh tokens, `/auth/logout` revocation.
- **Result Checker.** Compare a measured value against the catalog limits: `within limits`, `borderline`, `outside limits`, or a qualitative criterion when the catalog carries no numeric bound.
- Feedback, analytics and an evaluation dashboard.

**Stretch ideas.** Hindi and English support, voice input, nameplate OCR.

## Equipment and Topics Covered

| Equipment class | Example activities covered |
|---|---|
| Power Transformer | Insulation resistance and polarisation index, winding resistance, turns ratio, tan delta and capacitance, DGA, oil BDV and moisture, SFRA, Buchholz and OLTC checks |
| Reactors | Insulation resistance, winding resistance, tan delta, DGA, thermography, vibration and noise checks |
| Circuit Breaker | Contact resistance, timing test, SF6 gas quality and leakage, insulation resistance, operating mechanism checks, pre-commissioning checks |
| Instrument Transformers (CT / CVT / PT) | Ratio and polarity, insulation resistance, tan delta, burden, knee-point voltage, secondary injection |
| Surge Arresters | Insulation resistance, leakage current (total and resistive), thermography, counter checks |
| Others (extensible) | Isolators, batteries and chargers, earthing system, protection relays |

_The exact list depends on the documents loaded into the knowledge base. The catalog is built to grow._

## How an Answer Looks

Every procedural answer follows a consistent shape, so a reader always knows where to look:

```
Test: Insulation Resistance (IR) & Polarisation Index – Power Transformer

🦺 Safety:        Isolate → Earth → Verify dead → Permit-to-work → PPE     [fixed notice]
🧪 Test equipment: Insulation tester (e.g. 5 kV / 10 kV), leads, temperature probe   [1]
📝 Procedure:
   1. …   [1]
   2. …   [1]
📏 Acceptable limits:   <value / criterion from source>   [2]
📚 Standards:     <standard reference>   [2]
🛠️ If values are outside limits:   <probable causes and actions>   [3]

Sources: [1] OEM Manual p.42 · [2] Standard summary §5 · [3] Maintenance SOP p.9
```

_Numeric limits always come from the cited source or the verified test catalog. The model does not invent them._

## Demo

| | |
|---|---|
| Live app | [SubstationIQ](https://frontend-h8ikkpyfy-ayush-840s-projects.vercel.app) |
| Demo video | _add link_ |
| Demo login | `demo@substationiq.dev` / `demo1234` (Trainee) · `engineer@substationiq.dev` / `engineer1234` (Engineer) · `admin@substationiq.dev` / `admin1234` (Admin) |

```
![Chat](docs/screenshots/chat.png)
![Structured answer](docs/screenshots/structured-answer.png)
![Guided Procedure](docs/screenshots/procedure.png)
![Result Checker](docs/screenshots/result-checker.png)
![Admin](docs/screenshots/admin.png)
```

## Architecture

```
React (Vite) ──HTTPS / SSE──► FastAPI
                               ├─ Auth · Chat · Procedures · Diagnosis · Admin
                               ├─ Query understanding
                               │    intent classifier · equipment/test entity detection
                               │    · synonym & abbreviation expansion · query rewrite
                               ├─ Retrieval
                               │    hybrid (vector + BM25) → rerank → confidence check
                               │    + structured test catalog lookup
                               ├─ Guardrails (safety notice, bypass refusal, injection defence)
                               ├─ ChromaDB (vectors) + BM25 index
                               ├─ SQLite — source of truth (users, catalog, docs, messages)
                               ├─ MongoDB — document store (chat-history mirror, feedback, fault logs)
                               └─ LLM provider: Gemini · Groq · Ollama (swappable)
```

**Ingestion.** Upload → parse (text, tables, OCR fallback) → clean → structure-aware chunking (500–800 tokens, 100 overlap) → embed → index.

Full detail lives in [docs/TRD.md](docs/TRD.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn, SQLAlchemy, Alembic |
| NLP / LLM | Gemini Flash (primary), Groq Llama (fallback), Ollama (offline) |
| Embeddings | `BAAI/bge-small-en-v1.5` |
| Reranker | `BAAI/bge-reranker-base` (optional) |
| Vector DB | ChromaDB |
| Database | SQLite (source of truth) · MongoDB 7 (document store: conversation-history mirror, feedback, fault logs) |
| Keyword search | `rank_bm25` |
| Parsing | PyMuPDF, pdfplumber, python-docx, pytesseract |
| Evaluation | RAGAS / custom LLM-judge scripts |
| DevOps | Docker, Docker Compose |

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (optional, recommended)
- An API key for Gemini or Groq (free tiers work), or [Ollama](https://ollama.com) for fully local use
- Tesseract OCR (optional, for scanned PDFs)

### Option 1 — Docker (recommended)

```bash
git clone https://github.com/Ayush-840/SubstationAI.git
cd substationiq
cp .env.example .env        # add your API key
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

### Option 2 — Manual setup

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
alembic upgrade head
python -m app.scripts.seed         # demo users, sample docs, test catalog (idempotent)
uvicorn app.main:app --reload --port 8000
```

> If your database already has tables from before Alembic was introduced (created by `seed` alone), run `alembic stamp head` once instead of `alembic upgrade head`. Otherwise the initial migration fails on "table already exists". Fresh databases should use `alembic upgrade head`.

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Configuration

Set these in `.env`:

| Variable | Description | Example |
|---|---|---|
| `LLM_PROVIDER` | `gemini`, `groq` or `ollama` | `gemini` |
| `GEMINI_API_KEY` | Google AI Studio key | `...` |
| `GROQ_API_KEY` | Groq key (fallback) | `...` |
| `OLLAMA_MODEL` | Local model name | `llama3.1:8b` |
| `EMBED_MODEL` | Embedding model | `BAAI/bge-small-en-v1.5` |
| `DATABASE_URL` | DB connection string | `sqlite:///./app.db` |
| `JWT_SECRET` | Secret for signing tokens | `change-me` |
| `CHROMA_PATH` | Vector store directory | `./data/chroma` |
| `CONFIDENCE_THRESHOLD` | Minimum rerank score to answer | `0.35` |
| `MAX_UPLOAD_MB` | Upload size limit | `25` |

## Usage

1. **Log in** with a demo account.
2. **Ask a question**, optionally selecting an equipment chip. For example:
   - _"How do I perform an insulation resistance test on a power transformer?"_
   - _"What is the acceptable contact resistance for a circuit breaker?"_
   - _"Which instruments are needed for a tan delta test on a CT?"_
   - _"Leakage current is high on a surge arrester. What should I do?"_
   - _"Which standard covers DGA interpretation for transformers?"_
3. **Check sources.** Click a citation chip such as `[1] Manual · p.14`.
4. **Guided procedures.** Choose equipment and test, tick the safety gate, follow the steps, then export a PDF.
5. **Fault diagnosis.** Enter symptoms and readings to get ranked causes and recommended checks.
6. **Admin.** Upload documents under _Admin → Documents_ and wait for the status to read **Ready**.

## Project Structure

```
substationiq/
├── backend/
│   ├── app/
│   │   ├── api/          # routers: auth, chat, admin, procedures
│   │   ├── core/         # config, security, logging
│   │   ├── db/           # models, sessions, migrations
│   │   ├── nlp/          # intent classifier, entity detection, synonyms
│   │   ├── rag/          # ingest, chunking, retriever, reranker, guardrails, generator
│   │   ├── catalog/      # structured test catalog (equipment, tests, limits, standards)
│   │   ├── services/     # procedures, diagnosis, PDF export
│   │   └── schemas/
│   └── tests/
├── frontend/             # React app
├── backend/eval/         # run_eval.py evaluation harness
├── data/                 # raw_docs/, catalog/*.yaml, synthetic_logs.csv
├── docs/                 # screenshots/ and design documents
├── docker-compose.yml
└── README.md
```

## Evaluation

`backend/eval/` holds a test set covering each query type in the problem statement — procedure, limits, troubleshooting, equipment, standards, safety — plus out-of-scope, safety-sensitive and adversarial questions, each with a gold answer and source page.

```bash
cd backend
.venv/bin/python -m eval.run_eval             # full-pipeline eval (30 cases)
.venv/bin/python -m eval.run_eval --ablation  # retrieval ablation (vector vs BM25 vs hybrid)
```

The harness runs 30 cases across each query type in the problem statement (procedure, limits, troubleshooting, equipment, standards, safety, purpose), plus out-of-scope and adversarial/guardrail questions. It reports intent accuracy, entity accuracy, correct answer/refusal behaviour and latency.

| Metric | Result | Target |
|---|---|---|
| Intent accuracy | **100%** (30/30) | ≥ 90% |
| Entity accuracy | **93%** (28/30) | ≥ 90% |
| Expected-answer match (answers & refusals) | **100%** (30/30) | ≥ 90% |
| Median latency | **~330 ms** | < 8 s |
| p95 latency | **~560 ms** | < 12 s |

Per-intent results: procedure 6/6 · limits 6/6 · troubleshooting 5/5 · test_equipment 2/2 · standards 2/2 · safety 2/2 · purpose 1/1 · out_of_scope 4/4 · guardrail 2/2.

**Retrieval ablation** — vector vs BM25 vs hybrid (RRF), no reranker, raw retrieval over the indexed catalog chunks and sample docs; gold relevance is the query's gold equipment class. 26 of the 30 eval queries name an equipment class.

| Retrieval mode | Hit@5 | MRR@5 | p50 latency |
|---|---|---|---|
| Vector only | 84.6% | **0.846** | 9.4 ms |
| BM25 only | 92.3% | 0.728 | **3.0 ms** |
| **Hybrid (RRF)** | **96.2%** | 0.766 | 10.8 ms |

Hybrid gives the best recall. Vector retrieval misses queries whose wording drifts from the indexed text; BM25 catches exact domain terms; RRF fusion takes the union. Vector-only ranks its hits most confidently (highest MRR) but misses the most. BM25 is the fastest and, on this small corpus, more robust than vector. The shipped configuration uses hybrid plus a cross-encoder rerank.

The backend test suite also covers the NLP layer — intent, synonyms, abbreviations, fuzzy matching, citation and number verification, guardrails — and the API — auth, chat, catalog, procedures, diagnosis, admin.

## Authentication and session storage

Chosen strategy — **TRD Option A (cookie + double-submit CSRF)** — chosen deliberately because the frontend (Vercel) and backend (Render/Railway/Fly) live on different origins in deployment.

- **Access token.** Short-lived JWT, kept in memory on the client and sent as `Authorization: Bearer …`.
- **Refresh token.** Opaque, random, stored **only** in an `HttpOnly`, `Secure`, `SameSite=None` cookie scoped to `/api/auth/refresh`. `SameSite=None` is required: a `Lax` cookie is not attached to cross-site `fetch`/XHR, so it works on `localhost` but silently stops arriving at `/auth/refresh` once the frontend and backend live on different domains.
- **CSRF defence.** A second, non-HttpOnly cookie whose value the client echoes in an `X-CSRF-Token` header on `refresh`/`logout`; the server compares the two (double-submit). That is what makes `SameSite=None` safe.
- **Rotation.** Every refresh revokes the old token. Logout revokes the refresh cookie and deny-lists the access-token `jti` until expiry.

Tradeoff acknowledged: `SameSite=None` means the refresh cookie travels with cross-site requests, which is why the CSRF header check is mandatory rather than optional. The alternatives considered were Option B (keep the refresh token in localStorage — simpler, but a wider XSS exposure) and Option C (reverse-proxy the API under the frontend domain so `SameSite=Lax` works). If deployment ever moves to a single-origin reverse proxy, Option C is the cleaner fallback.

`/api/auth/refresh` and `/api/auth/logout` ship in this build: the refresh token is returned in the response **body** for API clients and set as the HttpOnly cookie for browsers, rotation is enforced server-side (only its SHA-256 is stored, and a consumed token cannot be replayed), and logout additionally deny-lists the access token's `jti` until expiry. The frontend still keeps the access token in `localStorage` (`frontend/src/api/client.ts`); moving it fully in-memory is the remaining client-side step.

## API Overview

Interactive docs at `/docs` (Swagger UI).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Get access + refresh token |
| POST | `/api/auth/refresh` | Rotate the refresh token into a new pair |
| POST | `/api/auth/logout` | Revoke refresh token, deny-list access `jti` |
| POST | `/api/chat/stream` | Streaming chat (SSE) |
| GET | `/api/catalog/tests` | Browse structured test catalog |
| POST | `/api/procedures/generate` | Build a checklist |
| POST | `/api/diagnosis` | Symptom-based diagnosis (Engineer or Admin) |
| POST | `/api/check-result` | Compare a measured value with catalog limits |
| POST | `/api/feedback` | Rate an answer |
| POST | `/api/admin/documents` | Upload a document (admin) |
| GET | `/api/admin/analytics` | Usage insights (admin) |

Full list in [docs/TRD.md](docs/TRD.md#6-api-specification).

### Result Checker contract

`POST /api/check-result`, refined against what the catalog actually contains (Days 1–5) — notably, some limits are qualitative, not numeric.

**Request**

```json
{
  "test_id": 12,
  "parameter": "Contact resistance per pole",
  "measured_value": 250.0,
  "unit": "µΩ",
  "condition_note": "New condition"
}
```

`condition_note` is optional: one parameter can carry several rows (age band, tap range, …). When both sides carry a note the server matches them by substring; otherwise it falls back to the first row.

**Response**

```json
{
  "status": "outside limits",
  "limit_value": "≤ 100 µΩ (New condition)",
  "source": "Test Catalog (condition: New condition)",
  "troubleshooting": [
    { "symptom": "High contact resistance", "cause": "Oxidised arcing contacts", "action": "Service the interrupter" }
  ]
}
```

| `status` | Meaning | `troubleshooting` |
|---|---|---|
| `within limits` | Inside `min_val`/`max_val`, more than 10% away from either bound | empty |
| `borderline` | Within 10% of a numeric bound | empty |
| `outside limits` | Beyond a numeric bound | populated from the catalog's probable causes |
| `see criterion` | The limit has no numeric bounds (e.g. *“no visible tracking on the surface”*): `limit_value` carries the criterion text and the caller compares by eye | empty |

`limit_value` is `value_text + unit`; `source` names the matched condition. The server never invents a numeric verdict for a qualitative limit.

## Testing

```bash
# Backend
cd backend && pytest -q

# Frontend
cd frontend && npm test

# Load test (optional)
locust -f backend/tests/locustfile.py
```

## Deployment

- **Backend.** Render or Railway (Dockerfile in `backend/`), with a persistent volume for Chroma.
- **Frontend.** Vercel or Netlify; set `VITE_API_URL` to the backend URL.
- **All-in-one.** `docker compose up -d` on any VPS.

Use a strong `JWT_SECRET` and set all variables from [Configuration](#configuration).

## Roadmap

- [x] Ingestion pipeline and hybrid retrieval
- [x] Intent detection and semantic query handling
- [x] Structured test catalog for the five equipment classes
- [x] Cited, structured answers (procedure, limits, standards, safety, equipment)
- [x] Guided Procedure Mode
- [x] Fault Diagnosis with DGA interpretation rules
- [x] Evaluation harness with intent/entity/answer metrics
- [x] Result Checker (numeric + qualitative)
- [x] Rate limiting, CORS, security headers
- [x] Redis caching (catalog + chat answers)
- [ ] Evaluation report with retrieval ablation (vector vs BM25 vs hybrid)
- [ ] Hindi and English support
- [ ] Voice input

_(Tick these off as you build.)_

## Limitations

- Answer quality depends on the coverage and accuracy of the loaded documents and catalog.
- Acceptable limits vary by voltage class, manufacturer and utility practice. Always confirm against the applicable OEM manual and utility standard.
- Not connected to live substation data or SCADA; no control actions.
- Sample SOPs and catalog entries are illustrative, not utility-approved.
- Scanned or table-heavy PDFs may parse imperfectly.

## Contributing

1. Fork the repo and create a branch: `git checkout -b feature/your-feature`
2. Commit with clear messages
3. Run tests and linters (`ruff`, `eslint`)
4. Open a pull request

## License

Released under the [MIT License](LICENSE).

## Acknowledgements

- Problem statement: _Intelligent chatbot to answer queries pertaining to various Maintenance Processes within Substation_, Ministry of Power, 2023
- Open-source tools: FastAPI, React, ChromaDB, Sentence-Transformers, RAGAS
- Public OEM manuals and IEC / IEEE / IS / CBIP / CEA guidance used as knowledge sources
- Project guide: _add name_ · Team: _add names_ · Institution: _add college_
