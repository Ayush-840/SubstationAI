# SubstationAssist-AI ⚡
> Intelligent Chatbot for Substation Asset Maintenance Processes & Safety Guidelines

![License](https://img.shields.io/badge/license-MIT-green)
![Domain](https://img.shields.io/badge/Domain-Smart%20Education%20%2F%20Power-blue)
![Category](https://img.shields.io/badge/Category-Software-orange)
![Cost](https://img.shields.io/badge/Deployment-100%25%20Free-brightgreen)

## 📌 Metadata
- **Source:** Smart India Hackathon / College Project
- **Problem Statement ID:** Ministry of Power (2023)
- **Domain:** Substation Asset Maintenance / AI & NLP
- **Stack:** Python, Streamlit, LangChain, ChromaDB, HuggingFace Inference API

---

## 🌟 Features
- **Semantic Technical Querying:** Answers maintenance procedures for Transformers, SF6 Circuit Breakers, Instrument Transformers, Reactors, and Surge Arresters.
- **Accurate Limit Extraction:** Provides exact dielectric, resistance, timing, and pressure parameters.
- **Automated Safety Ingestion:** Auto-triggers safety warnings, PTW requirements, and isolation guidelines.
- **Standard Alignment:** Incorporates IEEE, IEC, and IS standards.
- **100% Free Architecture:** Built entirely using open-source packages and zero-cost cloud tiers.

---

## 🚀 Quick Start (Local Setup)

1. **Clone Repository:**
   ```bash
   git clone https://github.com/your-username/substation-ai-chatbot.git
   cd substation-ai-chatbot
   ```

2. **Create Virtual Environment & Install:**
   ```bash
   python -m venv venv
   source venv/bin/activate # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set Up Environment Variables:**
   Create `.env` file:
   ```env
   HUGGINGFACEHUB_API_TOKEN=your_free_hf_token_here
   ```

4. **Run Application:**
   ```bash
   streamlit run app.py
   ```

---

## 📄 Repository Structure
```
├── knowledge_base/        # Substation manuals and standards (PDF/TXT)
├── app.py                 # Core Streamlit & RAG Application
├── RESEARCH.md            # Deep technical research document
├── PRD.md                 # Product Requirement Document
├── DRD.md                 # Data Requirement Document
├── DESIGN.md              # System Architecture & Flowchart
├── GUIDE.md               # Step-by-Step Implementation Guide
├── requirements.txt       # Python Dependencies
└── README.md              # Project Overview
```

## 📜 License
This project is open-source under the MIT License.