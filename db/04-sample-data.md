# 4. Sample data

The repeatable sample data is defined in [`backend/prisma/seed.js`](../backend/prisma/seed.js). The seed uses upserts for equipment and a check-before-update/create flow for tests.

## Current local snapshot

| Table | Rows | Notes |
|---|---:|---|
| `users` | 1 | Seeded System Admin; do not display the password hash |
| `equipment` | 8 | Transformer, Power Transformer, Current Transformer, Potential Transformer, Reactor, Circuit Breaker, Instrument Transformer, Surge Arrester |
| `tests` | 20 | Equipment-specific maintenance/test procedures |
| `documents` | 0 | No sample PDFs uploaded |
| `document_chunks` | 0 | Current ingestion is a stub |
| `chat_sessions` | 0 | No persistent sample conversation is seeded |
| `messages` | 0 | No persistent sample conversation is seeded |

Representative equipment/test rows:

| Equipment | Test |
|---|---|
| Circuit Breaker | Contact Resistance Test |
| Circuit Breaker | Timing Test |
| Circuit Breaker | SF6 Gas Leak and Moisture Test |
| Current Transformer | CT Ratio and Polarity Test |
| Potential Transformer | PT Insulation Resistance Test |
| Power Transformer | Winding Resistance Test (Power Transformer) |
| Surge Arrester | Third Harmonic Resistive Current Test |
| Reactor | Winding Resistance Test (Reactor) |

Test acceptance limits currently use the explicit placeholder `Verify against the applicable standard/manual.` until project source documents provide approved values.
