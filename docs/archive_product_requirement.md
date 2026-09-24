# Product Requirement Document (PRD)

## Project Title
**SubstationAssist-AI:** Intelligent Substation Asset Maintenance Assistant

## 1. Problem Statement
Substation asset maintenance involves intricate procedures for Transformers, Reactors, Circuit Breakers, Instrument Transformers, and Surge Arresters. Field engineers and technicians face challenges accessing exact testing limits, safety protocols, and troubleshooting steps quickly from lengthy physical or PDF manuals. An AI-powered solution is required to answer natural language queries accurately while adhering strictly to industrial safety guidelines and standards.

## 2. Target Audience
- Substation Maintenance Engineers & Technicians
- Grid Operations Safety Officers
- Electrical Engineering Trainees & Students

## 3. Core Capabilities & Features
- **Semantic Query Processing:** Understands natural language, technical acronyms (BDV, DGA, OLTC, SF6), and equipment colloquialisms.
- **Multi-Equipment Support:** Pre-loaded/ingestible knowledge base covering:
  - Power & Distribution Transformers
  - SF6 & Vacuum Circuit Breakers
  - Current & Potential Transformers (CT/PT)
  - Surge Arresters / Lightning Arresters
  - Shunt Reactors
- **Precise Limit Lookup:** Extraction of numerical limits (e.g., breakdown voltage $> 60\text{ kV}$, dielectric dissipation factor $\tan \delta \le 0.005$).
- **Safety Ingestion Layer:** Automatic highlighting of safety precautions (e.g., Isolation, Earthing, PTW, PPE requirements).
- **Source Attribution:** Displays exact document name, page number, and paragraph excerpt for auditability.

## 4. Non-Functional Requirements
- **Cost:** 100% Free to build, run, and host.
- **Latency:** Query response time $\le 3.5\text{ seconds}$.
- **Accuracy:** Zero-hallucination tolerance on critical safety parameters.
- **Usability:** Responsive chat layout, mobile-friendly for field use, PDF upload option for admins.

## 5. Success Metrics
- $\ge 90\%$ accuracy in retrieving acceptable limits.
- $100\%$ precision on safety warning injection for high-risk queries.
- $< 4\text{ s}$ response time on free-tier cloud instances.