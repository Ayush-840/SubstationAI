# PRD — SubstationIQ

**Intelligent Chatbot to Answer Queries Pertaining to Various Maintenance Processes within Substation**

| | |
|---|---|
| Organisation | Ministry of Power |
| Year | 2023 |
| Category | Software |
| Domain / Technology Bucket | Smart Education |
| Document version | 2.0 |

---

## 1. Overview

Substation asset maintenance covers several equipment classes: **transformers, reactors, circuit breakers, instrument transformers, surge arresters** and others. For each class, maintenance means carrying out tests and checks whose **procedures and acceptable limits are documented**, usually across many manuals, standards and SOPs.

**SubstationIQ** is an NLP-based chatbot that understands a user's question semantically and returns a structured, cited answer covering the **test steps, acceptable limits, issue-resolution actions, applicable industrial standards, safety guidelines and required test equipment**.

Because the technology bucket is **Smart Education**, the product doubles as a **training aid**: new engineers and technicians can learn maintenance activities on demand and test their knowledge.

## 2. Problem Statement (as given)

> Substation Asset Maintenance includes various maintenance activities for various equipment classes such as Transformer, Reactors, Circuit Breaker, Instrument Transformers, Surge Arrestors etc. Maintenance activity for all these equipments include carrying out various tests and checks for which procedures along with acceptable limits are documented. Need is for creating an intelligent chatbot based on natural language processing which may aid in answering user queries pertaining to various maintenance activities. Examples of such queries include steps to carry out a test, its probable values/acceptable limits, actions to resolve any issue faced during maintenance. The chatbot should have features for semantic processing of queries. It should also include industrial standards and safety guidelines and test equipment to follow that activity.

## 3. Requirement Traceability

Each sentence of the problem statement maps to a concrete product requirement.

| Problem statement requirement | Product requirement |
|---|---|
| Various equipment classes (Transformer, Reactors, CB, Instrument Transformers, Surge Arrestors, etc.) | Knowledge base and catalog organised by equipment class (FR-1, FR-2) |
| Tests and checks with documented procedures | Test procedure answers, step by step (FR-5) |
| Probable values / acceptable limits | Limits answers from verified catalog and cited sources (FR-6) |
| Actions to resolve issues faced during maintenance | Troubleshooting answers with causes and corrective actions (FR-7) |
| NLP-based chatbot | Conversational interface with streaming responses (FR-3) |
| Semantic processing of queries | Intent detection, entity and synonym handling, embedding-based retrieval (FR-4) |
| Industrial standards | Standards references attached to every test (FR-8) |
| Safety guidelines | Safety guidance and guardrails on every relevant answer (FR-9) |
| Test equipment to follow that activity | Test equipment list per activity (FR-10) |

## 4. Goals

1. Answer maintenance queries across the five named equipment classes accurately and with citations.
2. Support the three example query types in the statement: **procedure, limits, troubleshooting**, plus **standards, safety and test equipment** queries.
3. Understand questions phrased in different ways (synonyms, abbreviations, informal wording).
4. Never present an unsupported number or safety instruction; say so when information is not available.
5. Serve as a learning tool for new maintenance staff.
6. Demonstrate quality with a measurable evaluation.

## 5. Non-Goals

- No connection to live SCADA or substation systems; no control or switching actions.
- No replacement for official utility procedures, OEM instructions or work permits.
- No native mobile app (responsive web only).
- No certification or compliance decisions.

## 6. Users

| Persona | Description | Needs |
|---|---|---|
| **Field Technician** | Performs tests and routine maintenance | Quick steps, test equipment list, limits, safety reminders, phone-friendly |
| **Maintenance Engineer** | Plans work, analyses results and faults | Acceptable limits, standards, troubleshooting guidance with sources |
| **Trainee / New Engineer** | Learning maintenance practice | Plain explanations, why a test is done, practice quizzes |
| **Admin / Knowledge Manager** | Owns documents and test catalog | Upload, tag and version documents; maintain the test catalog; view analytics |

## 7. Query Types the System Must Handle

| Intent | Example queries |
|---|---|
| **Procedure** | "Steps to carry out insulation resistance test on a power transformer" |
| **Limits / values** | "Acceptable contact resistance for a circuit breaker", "Typical tan delta value for a CT" |
| **Troubleshooting** | "High leakage current on surge arrester, what to do?", "SF6 pressure dropping in breaker" |
| **Test equipment** | "Which instruments are needed for SFRA?" |
| **Standards** | "Which standard covers DGA interpretation?" |
| **Safety** | "Safety precautions before CT testing" |
| **Purpose / concept** | "Why is polarisation index measured?" |
| **Comparison / general** | "Difference between IR and PI test" |
| **Out of scope** | Anything unrelated to substation maintenance (politely declined) |

The system must cope with **synonyms and abbreviations**: IR / insulation resistance / megger test, PI, DGA, SFRA, tan delta / dissipation factor / power factor test, CT / PT / CVT, SF6, OLTC, BDV, etc.

## 8. Functional Requirements

### P0 — Must have
| ID | Requirement |
|---|---|
| FR-1 | Knowledge base covering **Transformer, Reactor, Circuit Breaker, Instrument Transformer, Surge Arrester** (Isolator, Battery, Earthing as extensions) |
| FR-2 | **Structured test catalog:** for each test, store purpose, test equipment, safety precautions, procedure steps, acceptable limits, standards, and troubleshooting notes |
| FR-3 | Chat interface with streaming responses and conversation history |
| FR-4 | **Semantic query processing:** intent detection, equipment and test recognition, synonym/abbreviation expansion, follow-up handling ("what about for a breaker?") |
| FR-5 | **Procedure answers:** ordered steps for the requested test |
| FR-6 | **Limits answers:** acceptable values with units, conditions (e.g. voltage class, temperature correction) and source |
| FR-7 | **Troubleshooting answers:** probable causes and corrective actions |
| FR-8 | **Standards references** (IEC, IEEE, IS, CBIP/CEA guidance) attached to answers |
| FR-9 | **Safety guidelines** on every relevant answer, plus a guardrail refusing requests to bypass safety devices |
| FR-10 | **Test equipment list** for each activity |
| FR-11 | **Citations** on every answer: document, page, section |
| FR-12 | **"Not found" behaviour:** clear response when the evidence is insufficient; log it for admin review |
| FR-13 | Equipment filter chips |
| FR-14 | Admin panel: upload, tag, list and delete documents (PDF, DOCX, TXT); catalog editor |
| FR-15 | Authentication with User and Admin roles |

### P1 — Should have
| ID | Requirement |
|---|---|
| FR-16 | **Guided Procedure Mode:** interactive checklist with mandatory safety confirmations and PDF export |
| FR-17 | **Fault Diagnosis Mode:** symptoms and readings to ranked probable causes with sources |
| FR-18 | **Learn Mode (Smart Education):** explain a test in simple terms, why it matters, and a short quiz per topic |
| FR-19 | Result checker: user enters a measured value; system compares against acceptable limits and says pass/borderline/investigate, citing the limit |
| FR-20 | Feedback (thumbs up/down) and admin analytics (top questions, unanswered queries) |
| FR-21 | Evaluation dashboard (retrieval, faithfulness, intent accuracy, latency) |

### P2 — Nice to have
| ID | Requirement |
|---|---|
| FR-22 | Hindi and English support |
| FR-23 | Voice input |
| FR-24 | Nameplate image OCR to equipment lookup |
| FR-25 | Maintenance log summariser |

## 9. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Accuracy | ≥ 85% answer correctness on the evaluation set; **limit values 100% match to source** |
| Latency | First token < 3 s; full answer < 12 s |
| Reliability | Automatic LLM fallback if the primary provider fails |
| Safety | Safety notice on 100% of live-equipment answers |
| Explainability | Every factual claim traceable to a cited source or catalog record |
| Security | Hashed passwords, JWT, role checks, upload validation, prompt-injection defences |
| Usability | Responsive UI; large touch targets for field use; WCAG AA contrast |

## 10. Standard Answer Format

Every procedural answer follows a consistent structure so users always find each element the problem statement asks for:

1. **Test / activity name** and equipment
2. **Safety guidelines**
3. **Test equipment required**
4. **Procedure (steps)**
5. **Acceptable limits / typical values**
6. **Applicable standards**
7. **If outside limits: probable causes and actions**
8. **Sources**

Other intents return the relevant subset (e.g. a pure "limits" query returns limits, conditions, standard and source, with a link to the full procedure).

## 11. Knowledge Base Plan

Real utility documents are hard to obtain, so combine:

- Public OEM manuals and datasheets
- Publicly available IEC / IEEE / IS summaries and guides; CEA and CBIP publicly available guidance
- Open-access papers and training material on transformer, breaker, CT/PT, arrester and reactor testing
- **Test catalog** built by the team from those sources, with every limit and standard reference recorded alongside its source
- Sample SOPs authored by the team, clearly labelled as samples
- Synthetic fault-log entries (50–100) for the diagnosis feature

Target: 5 equipment classes, **40–60 tests in the catalog**, 30–60 documents, 1,500–3,000 chunks.

## 12. Success Metrics

| Metric | Target |
|---|---|
| Intent classification accuracy | ≥ 90% |
| Equipment/test entity recognition accuracy | ≥ 90% |
| Answer correctness (60-question set) | ≥ 85% |
| Limit-value exact match to source | 100% |
| Citation accuracy | ≥ 90% |
| Correct refusal on out-of-scope / unsupported | ≥ 90% |
| Safety notice on live-equipment answers | 100% |
| Median response time | < 8 s |
| User satisfaction (feedback in a small pilot with classmates) | ≥ 80% positive |

## 13. Milestones (8 weeks)

| Week | Deliverable |
|---|---|
| 1 | Finalise scope, collect documents, list tests per equipment class, set up repo |
| 2 | Build the test catalog (first 20 tests) and ingestion pipeline |
| 3 | Hybrid retrieval and cited answer generation |
| 4 | Intent detection, entity recognition, synonym handling; chat UI with streaming |
| 5 | Structured answer format, safety guardrails, "not found" logic, auth and admin panel |
| 6 | Guided Procedure Mode, Fault Diagnosis, result checker; finish catalog (40+ tests) |
| 7 | Evaluation set, metrics, ablation, Learn Mode/quiz, bug fixing |
| 8 | Report, presentation, demo video, deployment and polish |

## 14. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Hard to obtain real substation documents | Use public manuals and standards; label sample SOPs; keep catalog sourced |
| Incorrect acceptable limits | Limits only from catalog/cited source; number-verification step; admin review |
| Limits vary by voltage class and manufacturer | Store conditions with each limit; answer states the applicable condition |
| LLM hallucination on safety-critical content | Grounded prompts, confidence gate, mandatory citations, fixed safety notices |
| Domain knowledge gap for the team | Consult faculty or an electrical-department contact to sanity-check the catalog |
| API limits during demo | Caching, provider fallback, offline model option |
| Scope creep | Freeze P0 by week 5 |

## 15. Deliverables

1. Deployed web application
2. GitHub repository with README
3. PRD, TRD and Design documents
4. Project report (problem, literature review, design, implementation, results)
5. Evaluation report with ablation and per-intent results
6. Presentation and 3–5 minute demo video

## 16. Disclaimer

SubstationIQ is an informational aid. It does not replace official procedures, permits, OEM instructions or trained personnel. The disclaimer is shown in the UI.
