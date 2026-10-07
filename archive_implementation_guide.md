# Complete Zero-Cost Step-by-Step Implementation Guide

This guide walks you through building and running **SubstationAssist-AI** on your computer for free, using Python, Streamlit, ChromaDB, and Hugging Face.

---

## Step 1: Prerequisites & Environment Setup

1. **Install Python:** Ensure Python 3.10 or higher is installed.
2. **Create Project Folder & Virtual Environment:**
   ```bash
   mkdir substation-ai-chatbot
   cd substation-ai-chatbot
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. **Get Free Hugging Face API Token:**
   - Sign up at [huggingface.co](https://huggingface.co).
   - Go to **Settings -> Access Tokens -> Create New Token (Read Access)**.

---

## Step 2: Install Required Dependencies

Create a `requirements.txt` file and install:
```text
streamlit==1.32.0
langchain==0.1.12
langchain-community==0.0.28
chromadb==0.4.24
sentence-transformers==2.5.1
pypdf==4.1.0
huggingface_hub==0.21.4
python-dotenv==1.0.1
```

Install via pip:
```bash
pip install -r requirements.txt
```

---

## Step 3: Create Knowledge Base Data

Create a folder `knowledge_base` and put sample maintenance documentation PDFs into it, or create a text file `knowledge_base/transformer_maintenance.txt`:

```text
EQUIPMENT: Power Transformer
TEST: Breakdown Voltage (BDV) Test of Transformer Oil
PROCEDURE:
1. Obtain Permit to Work (PTW) and isolate the transformer from high voltage grid.
2. Connect earthing leads securely.
3. Collect oil sample from bottom sampling valve into clean dry test cup.
4. Set electrode gap of BDV test kit to 2.5 mm using feeler gauge.
5. Apply voltage increasing smoothly at 2 kV/s until breakdown occurs.
6. Repeat 6 times on same sample and take average.

ACCEPTABLE LIMITS:
- 400 kV Class Transformer Oil BDV: Minimum 60 kV
- 220 kV Class Transformer Oil BDV: Minimum 50 kV
- 132 kV Class Transformer Oil BDV: Minimum 40 kV
STANDARD: IS 335 / IEC 60156
EQUIPMENT REQUIRED: Automated Oil Dielectric Test Set (0-100 kV)
SAFETY GUIDELINES: Always wear rubber gloves, safety goggles, and ensure double earthing before opening oil sampling valve.
```

---

## Step 4: Complete Python Application Code (`app.py`)

Create `app.py`:

```python
import os
import streamlit as st
from dotenv import load_dotenv

from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.llms import HuggingFaceHub
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

# Load environment variables
load_dotenv()

st.set_page_config(
    page_title="Substation Asset Maintenance AI",
    page_icon="⚡",
    layout="wide"
)

st.title("⚡ Substation Asset Maintenance AI Assistant")
st.caption("Powered by RAG, LangChain, HuggingFace & ChromaDB | Ministry of Power Project")

# Sidebar for Setup
with st.sidebar:
    st.header("🔑 Configuration")
    hf_api_key = st.text_input("HuggingFace API Token", type="password", help="Get free key at huggingface.co/settings/tokens")
    if hf_api_key:
        os.environ["HUGGINGFACEHUB_API_TOKEN"] = hf_api_key

    st.header("📚 Vector Store Management")
    if st.button("Build/Rebuild Knowledge Base"):
        if not hf_api_key:
            st.error("Please enter your HuggingFace API Token first!")
        else:
            with st.spinner("Ingesting Substation Manuals & Standards..."):
                # Load docs
                if not os.path.exists("knowledge_base"):
                    os.makedirs("knowledge_base")
                
                loader = DirectoryLoader("knowledge_base/", glob="**/*.*")
                documents = loader.load()
                
                # Split text
                text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
                chunks = text_splitter.split_documents(documents)
                
                # Embeddings & VectorStore
                embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
                vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory="./chroma_db")
                vectorstore.persist()
                st.success(f"Indexed {len(chunks)} knowledge chunks successfully!")

# Safety Guardrail Rule Engine
def inject_safety_guardrails(query: str) -> str:
    high_risk_words = ["test", "check", "procedure", "maintenance", "repair", "open", "oil", "gas"]
    if any(word in query.lower() for word in high_risk_words):
        return "\n\n⚠️ **MANDATORY SAFETY REMINDER:** Ensure Permit to Work (PTW) is issued, equipment is isolated, and safety earthing is applied before proceeding."
    return ""

# Main Query Interface
query = st.text_input("Ask any query regarding Substation Asset Maintenance:", placeholder="e.g., What is the procedure and BDV limit for 220kV Transformer Oil?")

if query:
    if not os.path.exists("./chroma_db"):
        st.warning("Please build the Knowledge Base from the sidebar first!")
    elif not os.environ.get("HUGGINGFACEHUB_API_TOKEN"):
        st.error("Please provide a HuggingFace API key in the sidebar.")
    else:
        with st.spinner("Analyzing maintenance manuals and standard procedures..."):
            # Load VectorStore
            embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)
            
            # Setup Prompt
            custom_prompt_template = """Use the following pieces of context from substation maintenance standards to answer the user query.
If you do not know the answer based on context, state clearly that information is not available in the ingested manual.

Context:
{context}

Question: {question}

Detailed Answer (Include Steps, Acceptable Limits, Safety Guidelines & Equipment required):"""
            
            PROMPT = PromptTemplate(template=custom_prompt_template, input_variables=["context", "question"])
            
            # Setup LLM via Free Hugging Face Hub
            llm = HuggingFaceHub(
                repo_id="mistralai/Mistral-7B-Instruct-v0.2",
                model_kwargs={"temperature": 0.2, "max_new_tokens": 512}
            )
            
            qa_chain = RetrievalQA.from_chain_type(
                llm=llm,
                chain_type="stuff",
                retriever=vectorstore.as_retriever(search_kwargs={"k": 3}),
                return_source_documents=True,
                chain_type_kwargs={"prompt": PROMPT}
            )
            
            response = qa_chain({"query": query})
            
            # Display Result
            safety_notice = inject_safety_guardrails(query)
            st.markdown("### 📋 Maintenance Response")
            st.write(response["result"])
            if safety_notice:
                st.warning(safety_notice)
                
            with st.expander("🔍 View Retrieved Document Sources"):
                for idx, doc in enumerate(response["source_documents"]):
                    st.markdown(f"**Source {idx+1}:** {doc.metadata.get('source', 'Manual')}")
                    st.text(doc.page_content)
```

---

## Step 5: How to Run Free Locally

1. Launch Streamlit:
   ```bash
   streamlit run app.py
   ```
2. Open browser at `http://localhost:8501`.
3. Paste HuggingFace API key in sidebar and click **Build/Rebuild Knowledge Base**.
4. Test with queries!

---

## Step 6: Deploy to HuggingFace Spaces (100% Free Hosting)

1. Create a free account at [Hugging Face](https://huggingface.co).
2. Go to **Spaces** -> **Create New Space**.
3. Select **Streamlit** as SDK and set repository visibility to **Public**.
4. Push `app.py`, `requirements.txt`, and `knowledge_base/` files to your Space repository.
5. Add `HUGGINGFACEHUB_API_TOKEN` under Space **Settings -> Secrets**.
6. Your live web app link is generated automatically!