"""Pipeline Diagnostic Logging Script

Walks one query through intent -> retrieval -> rerank -> confidence ->
generation and prints each stage, using the real SubstationIQ modules.
Run from the backend directory:  .venv/bin/python ../gemini-code-1790248949791.py
"""

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
os.environ.setdefault("LLM_PROVIDER", "none")

from app.db.session import SessionLocal  # noqa: E402
from app.catalog.lookup import CatalogLookup  # noqa: E402
from app.nlp.intent import intent_classifier  # noqa: E402
from app.rag.retriever import retriever  # noqa: E402
from app.rag.reranker import reranker  # noqa: E402
from app.rag.assembler import AnswerAssembler  # noqa: E402
from app.core.config import get_settings  # noqa: E402

settings = get_settings()


def calculate_confidence(rerank_score: float, has_catalog: bool, intent: str) -> float:
    if intent == "out_of_scope":
        return 1.0
    intent_score = 1.0 if intent != "procedure" or has_catalog else 0.8
    catalog_bonus = 0.25 if has_catalog else 0.0
    combined = 0.6 * rerank_score + 0.15 * intent_score + catalog_bonus
    return round(min(1.0, max(0.0, combined)), 2)


def run_pipeline_diagnostics(query: str) -> None:
    print(f"[STEP 1] Raw Query: {query}")

    understanding = intent_classifier.classify(query)
    print(
        f"[STEP 2] Intent={understanding.intent} | "
        f"Equipment={understanding.equipment} | Test={understanding.test}"
    )

    db = SessionLocal()
    try:
        catalog = CatalogLookup(db)
        equipment = None
        test = None
        if understanding.equipment:
            equipment = catalog.find_equipment(understanding.equipment)
        if understanding.test and equipment:
            test = catalog.find_test(equipment.id, understanding.test)
        if test is None:
            tests = catalog.search_tests(
                understanding.test or understanding.standalone_query,
                equipment_id=equipment.id if equipment else None,
            )
            if tests:
                test = tests[0]
                if equipment is None:
                    equipment = catalog.get_equipment_by_id(test.equipment_class_id)

        equipment_id = equipment.id if equipment else None
        test_id = test.id if test else None

        retrieved = retriever.search(
            understanding.standalone_query,
            equipment_class_id=equipment_id,
            test_id=test_id,
            top_k_vector=settings.TOP_K_VECTOR,
            top_k_bm25=settings.TOP_K_BM25,
        )
        print(
            f"[STEP 3] Retrieved Chunk Count: {len(retrieved)} | "
            f"filter equipment_id={equipment_id} test_id={test_id}"
        )
        for chunk in retrieved[:3]:
            meta = chunk.get("metadata") or {}
            page = meta.get("page_start")
            if page in (None, -1):
                page = "?"
            print(
                f"  - Chunk ID: {chunk.get('chunk_id')} | "
                f"equipment_class_id: {meta.get('equipment_class_id')} | "
                f"Page: {page}"
            )

        reranked = reranker.rerank(
            understanding.standalone_query, retrieved, settings.TOP_K_RERANK
        )
        top_score = 0.0
        if reranked:
            raw = reranked[0].get("rerank_score", reranked[0].get("score", 0)) or 0
            top_score = min(1.0, max(0.0, float(raw)))
        confidence = calculate_confidence(top_score, test is not None, understanding.intent)
        if reranked:
            print(
                f"[STEP 4] Rerank Top-1 Score: {top_score:.4f} | "
                f"Final Confidence: {confidence:.4f}"
            )
        else:
            print(f"[STEP 4] No rerank hits | Final Confidence: {confidence:.4f}")

        assembler = AnswerAssembler(db)
        result = assembler.assemble(understanding)
        print(f"[STEP 5] Final Response Output:\n{result['answer']}")
        print(
            f"[STEP 5] confidence={result['confidence']} "
            f"source_type={result['source_type']} citations={len(result['citations'])}"
        )
        for c in result["citations"]:
            page = c.get("page")
            if page in (None, -1, ""):
                raise AssertionError(f"Page: None leaked into citation: {c}")
    finally:
        db.close()


if __name__ == "__main__":
    run_pipeline_diagnostics("What is circuit breaker contact resistance?")
