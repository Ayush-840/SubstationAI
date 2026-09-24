# Presentation Deck & Viva Questions: SubstationAssist-AI

## Slide 1: Title Slide
- **Project Title:** SubstationAssist-AI: Intelligent Chatbot for Substation Asset Maintenance
- **Problem Statement:** AI-powered solution for answering technical maintenance, safety, and testing queries for High Voltage Substation Assets.
- **Organization:** Ministry of Power (2023 Domain Challenge)

## Slide 2: Problem & Existing Challenges
- Substation equipment (Transformers, Circuit Breakers, Instrument Transformers, Surge Arresters) requires periodic testing.
- Field engineers must search through hundreds of pages of IEEE/IEC standards and manuals during maintenance.
- High risk of safety standard oversight leading to accidents or catastrophic equipment failure.

## Slide 3: Solution Architecture (RAG)
- **Retrieval-Augmented Generation (RAG):** Combines Vector Search (ChromaDB) with Open LLMs (Mistral-7B / Llama 3) to give precise, zero-hallucination answers.
- **Safety Injection Layer:** Detects operational intent and forces critical safety callouts (Isolation, Earthing, PTW).
- **Zero Cost Deployment:** Built completely on open-source tools and hosted free on HuggingFace Spaces.

---

## Expected Viva / Evaluation Questions & Answers

### Q1: Why use Retrieval-Augmented Generation (RAG) instead of fine-tuning an LLM?
**Answer:** Fine-tuning modifies model weights but still suffers from hallucinations, is expensive to retrain when standards update, and lacks explicit document citation. RAG allows us to swap or update PDFs dynamically in ChromaDB with zero retraining cost and provides clear page/source attribution for critical safety verification.

### Q2: How does the system ensure safety limits (like Transformer BDV or Tan Delta) are accurate?
**Answer:** The system uses strict prompt engineering bounding the LLM to only respond using chunks retrieved from official standards. If a numerical limit is not present in the vector store context, the LLM is instructed to answer *"Information not found in ingested manuals"* rather than guessing.

### Q3: How do you handle non-textual data in technical manuals, such as tables?
**Answer:** We utilize `pdfplumber` for PDF chunking which preserves tabular structure into text formats like Markdown tables before vector embedding.

### Q4: What makes this solution scalable and free?
**Answer:** We utilize open-source embeddings (`all-MiniLM-L6-v2`), local vector storage (`ChromaDB`), free HuggingFace Serverless LLM Inference APIs, and Streamlit Community Cloud for UI hosting.