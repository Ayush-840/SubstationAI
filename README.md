# ⚡ SubstationIQ

**An intelligent, semantic chatbot that answers queries on substation asset maintenance: test procedures, acceptable limits, troubleshooting actions, applicable standards, safety guidelines and required test equipment.**

| | |
|---|---|
| **Problem Statement** | Intelligent chatbot to answer queries pertaining to various Maintenance Processes within Substation |
| **Organisation** | Ministry of Power |
| **Year** | 2023 |
| **Category** | Software |
| **Domain / Technology Bucket** | Smart Education |

> ⚠️ **Disclaimer:** SubstationIQ is an informational aid. It does not replace official utility procedures, OEM instructions, work permits or trained personnel. Sample content bundled in this repo is for demonstration only.

---

## Table of Contents

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

Substation asset maintenance covers many equipment classes, such as **transformers, reactors, circuit breakers, instrument transformers and surge arresters**. Maintaining each of them involves carrying out tests and checks, for which **procedures and acceptable limits are documented**.

The need is an **NLP-based intelligent chatbot** that helps users with queries about maintenance activities, for example:

- Steps to carry out a test
- Probable values and acceptable limits
- Actions to resolve an issue faced during maintenance

The chatbot must support **semantic processing of queries** and should also include **industrial standards, safety guidelines, and the test equipment** required to carry out each activity.

## Our Solution

SubstationIQ is a **retrieval-augmented, standards-aware assistant**. It understands the intent of a question (procedure, limits, troubleshooting, equipment, safety, standards), retrieves the most relevant passages from a curated knowledge base of manuals, SOPs and standards, and answers in a **structured, cited format**. It refuses to guess when the documents don't support an answer.

Two knowledge layers work together:

1. **Document knowledge (RAG):** manuals, SOPs, guidelines, standards summaries, chunked, embedded and searchable semantically.
2. **Structured test catalog:** a curated registry of tests per equipment (purpose, test equipment, safety precautions, steps, acceptable limits, standards, troubleshooting), so critical numbers such as limits come from verified records and not free-form generation.

## Features

**Core (maps to the problem statement)**
- 🧠 **Semantic query understanding:** natural-language queries, synonyms and abbreviations (e.g. *IR test*, *insulation resistance*, *megger test*; *PI*, *DGA*, *SFRA*, *tan delta*)
- 🎯 **Intent detection:** procedure, acceptable limits, troubleshooting, test equipment, standards, safety
- 📋 **Test procedures:** step-by-step instructions for each maintenance test
- 📏 **Acceptable limits and typical values:** shown with the source and the standard they come from
- 🛠️ **Issue resolution:** probable causes and corrective actions for maintenance problems
- 📚 **Industrial standards:** references such as IEC, IEEE, IS and CBIP/CEA guidance, with citations
- 🦺 **Safety guidelines:** isolation, earthing, PPE, permit-to-work reminders on every relevant answer
- 🧪 **Test equipment:** instruments required for each activity (e.g. insulation tester, winding resistance meter, tan delta kit, SFRA analyser, contact resistance meter, breaker analyser)
- 🔗 **Citations on every answer:** document, page and section
- 🛑 **"Not found" behaviour:** clear response when the knowledge base lacks reliable information

**Supporting**
- 💬 Streaming chat with equipment filters
- ✅ Guided Procedure Mode with mandatory safety confirmations and PDF export
- 🩺 Fault Diagnosis Mode: symptoms and readings to ranked probable causes
- 📁 Admin panel to upload, tag and manage documents (PDF, DOCX, TXT)
- 🔐 JWT auth with User and Admin roles
- 👍 Feedback, analytics and an evaluation dashboard

**Stretch:** Hindi and English support, voice input, nameplate OCR.

## Equipment and Topics Covered

| Equipment class | Example activities covered |
|---|---|
| **Power Transformer** | Insulation resistance and polarisation index, winding resistance, turns ratio, tan delta and capacitance, DGA, oil BDV and moisture, SFRA, Buchholz and OLTC checks |
| **Reactors** | Insulation resistance, winding resistance, tan delta, DGA, thermography, vibration and noise checks |
| **Circuit Breaker** | Contact resistance, timing test, SF6 gas quality and leakage, insulation resistance, operating mechanism checks, pre-commissioning checks |
| **Instrument Transformers (CT / CVT / PT)** | Ratio and polarity, insulation resistance, tan delta, burden, knee-point voltage, secondary injection |
| **Surge Arresters** | Insulation resistance, leakage current (total and resistive), thermography, counter checks |
| **Others (extensible)** | Isolators, batteries and chargers, earthing system, protection relays |

_The exact list depends on the documents loaded into the knowledge base; the catalog is extensible._

## How an Answer Looks

Every procedural answer follows a consistent structure:

```
Test: Insulation Resistance (IR) & Polarisation Index – Power Transformer

🦺 Safety:   Isolate → Earth → Verify dead → Permit-to-work → PPE  [fixed notice]
🧪 Test equipment:  Insulation tester (e.g. 5 kV / 10 kV), leads, temperature probe  [1]
📝 Procedure:
   1. …   [1]
   2. …   [1]
📏 Acceptable limits:  <value / criterion from source>  [2]
📚 Standards:  <standard reference>  [2]
🛠️ If values are outside limits:  <probable causes and actions>  [3]

Sources: [1] OEM Manual p.42 · [2] Standard summary §5 · [3] Maintenance SOP p.9
```

_Numeric limits are always taken from the cited source or the verified test catalog, never invented by the model._

## Demo

| | |
|---|---|
| 🌐 Live app | _add link_ |
| 🎥 Demo video | _add link_ |
| 🔑 Demo login | `demo@substationiq.dev` / `demo1234` (User) · `admin@substationiq.dev` / `admin1234` (Admin) |

```
![Chat](docs/screenshots/chat.png)
![Structured answer](docs/screenshots/structured-answer.png)
![Guided Procedure](docs/screenshots/procedure.png)
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
                               ├─ PostgreSQL / SQLite (users, chats, docs, test catalog)
                               └─ LLM provider: Gemini · Groq · Ollama (swappable)
```

**Ingestion:** upload → parse (text, tables, OCR fallback) → clean → structure-aware chunking (500–800 tokens, 100 overlap) → embed → index.

Full detail in [`docs/TRD.md`](docs/TRD.md).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn, SQLAlchemy, Alembic |
| NLP / LLM | Gemini Flash (primary), Groq Llama (fallback), Ollama (offline) |
| Embeddings | `BAAI/bge-small-en-v1.5` |
| Reranker | `BAAI/bge-reranker-base` (optional) |
| Vector DB | ChromaDB |
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

### Option 1: Docker (recommended)

```bash
git clone https://github.com/<your-username>/substationiq.git
cd substationiq
cp .env.example .env        # add your API key
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

### Option 2: Manual setup

**Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
alembic upgrade head
python -m app.scripts.seed         # demo users, sample docs, test catalog
uvicorn app.main:app --reload --port 8000
```

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
2. **Ask a question**, optionally selecting an equipment chip. Examples:
   - *"How do I perform an insulation resistance test on a power transformer?"*
   - *"What is the acceptable contact resistance for a circuit breaker?"*
   - *"Which instruments are needed for a tan delta test on a CT?"*
   - *"Leakage current is high on a surge arrester. What should I do?"*
   - *"Which standard covers DGA interpretation for transformers?"*
3. **Check sources:** click a citation chip such as `[1] Manual · p.14`.
4. **Guided Procedures:** choose equipment and test, tick the safety gate, follow the steps, export a PDF.
5. **Fault Diagnosis:** enter symptoms and readings to get ranked causes and recommended checks.
6. **Admin:** upload documents under *Admin → Documents* and wait for **Ready**.

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

`backend/eval/` holds a test set covering each query type in the problem statement (procedure, limits, troubleshooting, equipment, standards, safety), plus out-of-scope, safety-sensitive and adversarial questions, each with a gold answer and source page.

```bash
cd backend
.venv/bin/python -m eval.run_eval             # full-pipeline eval (30 cases)
.venv/bin/python -m eval.run_eval --ablation  # retrieval ablation (vector vs BM25 vs hybrid)
```

The harness runs 30 cases covering each query type in the problem statement (procedure, limits, troubleshooting, equipment, standards, safety, purpose), plus out-of-scope and adversarial/guardrail questions, and reports intent accuracy, entity accuracy, correct answer/refusal behaviour and latency.

| Metric | Result | Target |
|---|---|---|
| Intent accuracy | **100%** (30/30) | ≥ 90% |
| Entity accuracy | **93%** (28/30) | ≥ 90% |
| Expected-answer match (answers & refusals) | **100%** (30/30) | ≥ 90% |
| Median latency | **~330 ms** | < 8 s |
| p95 latency | **~560 ms** | < 12 s |

Per-intent results: procedure 6/6 · limits 6/6 · troubleshooting 5/5 · test_equipment 2/2 · standards 2/2 · safety 2/2 · purpose 1/1 · out_of_scope 4/4 · guardrail 2/2.

**Retrieval ablation** — vector vs BM25 vs hybrid (RRF), no reranker, raw retrieval over the indexed catalog chunks and sample docs; gold relevance = the query's gold equipment class. 26 of the 30 eval queries name an equipment class.

| Retrieval mode | Hit@5 | MRR@5 | p50 latency |
|---|---|---|---|
| Vector only | 84.6% | **0.846** | 9.4 ms |
| BM25 only | 92.3% | 0.728 | **3.0 ms** |
| **Hybrid (RRF)** | **96.2%** | 0.766 | 10.8 ms |

Hybrid gives the best recall: vector retrieval misses queries whose wording drifts from the indexed text, BM25 catches exact domain terms, and RRF fusion takes the union. Vector-only ranks its hits most confidently (highest MRR) but misses the most; BM25 is the fastest and more robust than vector on this small corpus. The shipped configuration uses hybrid + cross-encoder rerank.

The backend test suite (34 tests) additionally covers the NLP layer (intent, synonyms, abbreviations, fuzzy matching, citation and number verification, guardrails) and the API (auth, chat, catalog, procedures, diagnosis, admin).

## API Overview

Interactive docs at `/docs` (Swagger UI).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Get JWT |
| POST | `/api/chat/stream` | Streaming chat (SSE) |
| GET | `/api/catalog/tests` | Browse structured test catalog |
| POST | `/api/procedures/generate` | Build a checklist |
| POST | `/api/diagnosis` | Symptom-based diagnosis |
| POST | `/api/feedback` | Rate an answer |
| POST | `/api/admin/documents` | Upload a document (admin) |
| GET | `/api/admin/analytics` | Usage insights (admin) |

Full list in [`docs/TRD.md`](docs/TRD.md#6-api-specification).

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

- **Backend:** Render or Railway (Dockerfile in `backend/`), with a persistent volume for Chroma.
- **Frontend:** Vercel or Netlify; set `VITE_API_URL` to the backend URL.
- **All-in-one:** `docker compose up -d` on any VPS.

Use a strong `JWT_SECRET` and set all variables from [Configuration](#configuration).

## Roadmap

- [x] Ingestion pipeline and hybrid retrieval
- [x] Intent detection and semantic query handling
- [x] Structured test catalog for the five equipment classes
- [x] Cited, structured answers (procedure, limits, standards, safety, equipment)
- [x] Guided Procedure Mode
- [x] Fault Diagnosis with DGA interpretation rules
- [x] Evaluation harness with intent/entity/answer metrics
- [ ] Evaluation report with retrieval ablation (vector vs BM25 vs hybrid)
- [ ] Hindi and English support
- [ ] Voice input

_(Tick these off as you build.)_

## Limitations

- Answer quality depends on the coverage and accuracy of the loaded documents and catalog.
- Acceptable limits vary by voltage class, manufacturer and utility practice; always confirm against the applicable OEM manual and utility standard.
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

- Problem statement: *Intelligent chatbot to answer queries pertaining to various Maintenance Processes within Substation*, Ministry of Power, 2023
- Open-source tools: FastAPI, React, ChromaDB, Sentence-Transformers, RAGAS
- Public OEM manuals and IEC / IEEE / IS / CBIP / CEA guidance used as knowledge sources
- Project guide: _add name_ · Team: _add names_ · Institution: _add college_
