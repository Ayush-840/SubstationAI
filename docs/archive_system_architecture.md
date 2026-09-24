# Architecture & System Design Document

## 1. Logical Architecture

```
+-----------------------------------------------------------------------+
|                          Streamlit Frontend UI                         |
|   +-----------------------+ +--------------------+ +--------------+   |
|   | Interactive Chat Room | | Equipment Filter   | | Source Viewer|   |
|   +-----------------------+ +--------------------+ +--------------+   |
+-----------------------------------------------------------------------+
                                    |
                                    v (REST API / Direct Function)
+-----------------------------------------------------------------------+
|                     LangChain RAG Core Orchestrator                   |
|                                                                       |
|   +---------------------+   +-------------------+   +-------------+   |
|   | Dynamic Safety Guard |-->| Hybrid Retriever  |-->| Context     |   |
|   | (Regex + Keyword)   |   | (Vector + BM25)   |   | Re-Ranker   |   |
|   +---------------------+   +-------------------+   +-------------+   |
+-----------------------------------------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
| Chroma Vector Store   |                       | HuggingFace API Engine|
| (Dense Embeddings)    |                       | (Llama-3-8B-Instruct) |
+-----------------------+                       +-----------------------+
```

## 2. Data Flow Sequence
1. **User Query Input:** User enters query: *"What is the procedure and limit for SF6 gas leakage test in a 132kV circuit breaker?"*
2. **Safety Check Filter:** Query is screened. If action verb detected (e.g., *test, open, dismantle, check*), Safety Rule Engine flags required PPE & isolation steps.
3. **Retrieval Phase:** 
   - Vector Search generates top-10 chunks.
   - BM25 searches exact terms (`SF6`, `leakage limit`, `132kV`).
   - Combined RRF extracts top-5 chunks.
4. **Context Construction:** Direct context string formatted with citations.
5. **LLM Generation:** Query + Safety Rule + Context passed to LLM.
6. **Response Presentation:** UI renders structured response with expandable source context.