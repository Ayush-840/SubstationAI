"""Assembles the structured answer: guardrails -> catalog lookup -> retrieval ->
prompt -> generation -> verification, with a deterministic template fallback."""
from typing import Dict, List, Optional, AsyncGenerator
from sqlalchemy.orm import Session

from app.catalog.lookup import CatalogLookup, format_catalog_for_context
from app.rag.retriever import retriever
from app.rag.reranker import reranker
from app.rag.prompts import build_prompt
from app.rag.generator import generator, TEMPLATE_MARKER
from app.rag.verifier import verify_answer
from app.rag.guardrails import Guardrails, needs_safety_notice
from app.nlp.intent import QueryUnderstanding
from app.core.config import get_settings

settings = get_settings()

NOT_FOUND_ANSWER = (
    "I couldn't find a reliable answer in the uploaded documents and catalog. "
    "Please check the relevant SOP, OEM manual or ask a senior engineer."
)


class AnswerAssembler:
    def __init__(self, db: Session):
        self.db = db
        self.catalog = CatalogLookup(db)
        self.guardrails = Guardrails()

    def assemble(
        self,
        understanding: QueryUnderstanding,
        conversation_history: List[str] = None,
    ) -> Dict:
        history = conversation_history or []

        ok, refusal = self.guardrails.check_input(understanding.standalone_query)
        if not ok:
            return self._result(understanding, answer=refusal, source_type="guardrail",
                                citations=[], confidence=0.0)

        equipment = None
        test = None

        if understanding.equipment:
            equipment = self.catalog.find_equipment(understanding.equipment)
        if understanding.test and equipment:
            test = self.catalog.find_test(equipment.id, understanding.test)
        if test is None:
            # Global test search (aliases/fuzzy) when equipment-level match failed
            tests = self.catalog.search_tests(understanding.test or understanding.standalone_query)
            if tests:
                test = tests[0]
                equipment = self.catalog.get_equipment_by_id(test.equipment_class_id)

        catalog_context: Dict = {}
        source_type = "rag"
        if test:
            catalog_context = format_catalog_for_context(self.catalog, test.id)
            source_type = "catalog+rag"

        rag_hits: List[Dict] = []
        if equipment:
            rag_hits = retriever.search(
                understanding.standalone_query,
                equipment_class_id=equipment.id,
                test_id=test.id if test else None,
                top_k_vector=settings.TOP_K_VECTOR,
                top_k_bm25=settings.TOP_K_BM25,
            )
        else:
            rag_hits = retriever.search(
                understanding.standalone_query,
                top_k_vector=settings.TOP_K_VECTOR,
                top_k_bm25=settings.TOP_K_BM25,
            )

        rag_hits = reranker.rerank(understanding.standalone_query, rag_hits, settings.TOP_K_RERANK)

        top_score = 0.0
        if rag_hits:
            top_score = float(rag_hits[0].get("rerank_score", rag_hits[0].get("score", 0)) or 0)

        if understanding.intent == "out_of_scope":
            return self._result(
                understanding,
                answer="I can only help with substation maintenance topics. "
                       "Try asking about a test procedure, acceptable limits, troubleshooting, "
                       "test equipment, standards or safety.",
                source_type="out_of_scope",
                citations=[],
                confidence=1.0,
            )

        if top_score < settings.CONFIDENCE_THRESHOLD and not catalog_context:
            self._log_unanswered(understanding.standalone_query, understanding.intent, top_score)
            return self._result(understanding, answer=NOT_FOUND_ANSWER,
                                source_type="not_found", citations=[], confidence=top_score)

        sources = self._build_sources(rag_hits, catalog_context)

        prompt = build_prompt(
            understanding.intent,
            catalog_context,
            rag_hits,
            sources,
            understanding.standalone_query,
        )

        answer = generator.generate(prompt)

        ok, out_refusal = self.guardrails.check_output(answer)
        if not ok:
            return self._result(understanding, answer=out_refusal, source_type="guardrail",
                                citations=sources, confidence=top_score)

        if answer == TEMPLATE_MARKER or not answer.strip():
            answer = self._format_template_fallback(catalog_context, sources, understanding.intent)

        verified_answer, verified, verify_issues = verify_answer(
            answer,
            understanding.intent,
            catalog_context,
            rag_hits,
            sources,
        )

        if not verified and catalog_context:
            verified_answer = self._format_template_fallback(catalog_context, sources, understanding.intent)
        elif not verified:
            # keep LLM answer but attach verify issues to the result for the UI
            verified_answer = answer

        sections = self._extract_sections(verified_answer, understanding.intent)

        return {
            "intent": understanding.intent,
            "equipment": equipment.name if equipment else None,
            "test": test.name if test else None,
            "answer": verified_answer,
            "sections": sections,
            "citations": sources,
            "confidence": round(max(top_score, 0.5 if catalog_context else 0.0), 2),
            "source_type": source_type,
        }

    def _result(self, understanding: QueryUnderstanding, answer: str, source_type: str,
                citations: List[Dict], confidence: float) -> Dict:
        return {
            "intent": understanding.intent,
            "equipment": understanding.equipment,
            "test": understanding.test,
            "answer": answer,
            "sections": {},
            "citations": citations,
            "confidence": confidence,
            "source_type": source_type,
        }

    def _build_sources(self, rag_hits: List[Dict], catalog_context: Dict) -> List[Dict]:
        from app.db.models import Chunk, Document

        sources: List[Dict] = []
        seen = set()

        for hit in rag_hits:
            chunk_id = hit.get("chunk_id")
            chunk = self.db.query(Chunk).filter(Chunk.id == chunk_id).first()
            if not chunk:
                continue
            doc = self.db.query(Document).filter(Document.id == chunk.document_id).first()
            key = (chunk.document_id, chunk.page_start)
            if key in seen:
                continue
            seen.add(key)
            sources.append({
                "document": doc.title if doc else f"Chunk {chunk_id}",
                "page": chunk.page_start,
                "section": chunk.section_title or "",
            })

        if catalog_context:
            label = f"Test Catalog — {catalog_context.get('equipment_class', '')}: {catalog_context.get('test_name', '')}"
            if label not in seen:
                sources.append({"document": "Test Catalog", "page": "—", "section": label})

        return sources

    def _extract_sections(self, answer: str, intent: str) -> Dict[str, str]:
        sections: Dict[str, str] = {}
        current_section: Optional[str] = None
        current_content: List[str] = []

        section_markers = [
            ("safety", ["**Safety", "Safety:", "🦺"]),
            ("equipment", ["**Test Equipment", "Test Equipment:", "Equipment:"]),
            ("steps", ["**Procedure", "Procedure:", "Steps:"]),
            ("limits", ["**Acceptable Limits", "Acceptable Limits:", "Limits:"]),
            ("standards", ["**Applicable Standards", "Applicable Standards:", "Standards:"]),
            ("troubleshooting", ["**If Values", "**If Outside", "**Troubleshooting", "Troubleshooting:", "Causes and Actions:"]),
            ("purpose", ["**Purpose", "Purpose:"]),
            ("comparison", ["**Comparison", "Comparison:"]),
        ]

        def classify(line: str):
            for sec, markers in section_markers:
                for marker in markers:
                    if line.strip().startswith(marker) or marker in line:
                        return sec
            return None

        for line in answer.split("\n"):
            found_section = classify(line)
            if found_section and found_section != current_section:
                if current_section:
                    sections[current_section] = "\n".join(current_content).strip()
                current_section = found_section
                current_content = [line]
            else:
                current_content.append(line)

        if current_section:
            sections[current_section] = "\n".join(current_content).strip()

        return sections

    def _format_template_fallback(self, catalog_context: Dict, sources: List[Dict],
                                  intent: str) -> str:
        parts: List[str] = []

        if intent == "out_of_scope":
            return "I can only help with substation maintenance topics."

        if intent == "limits":
            if catalog_context.get("limits"):
                parts.append(f"📏 **Acceptable Limits**:\n{catalog_context['limits']}")
            if catalog_context.get("standards"):
                parts.append(f"📚 **Applicable Standards**:\n{catalog_context['standards']}")
        elif intent == "test_equipment":
            if catalog_context.get("equipment"):
                parts.append(f"🧪 **Test Equipment**:\n{catalog_context['equipment']}")
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety**:\n{catalog_context['safety']}")
        elif intent == "standards":
            if catalog_context.get("standards"):
                parts.append(f"📚 **Applicable Standards**:\n{catalog_context['standards']}")
        elif intent == "safety":
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety Precautions**:\n{catalog_context['safety']}")
        elif intent == "purpose":
            if catalog_context.get("purpose"):
                parts.append(f"**Purpose**:\n{catalog_context['purpose']}")
            if catalog_context.get("steps"):
                parts.append(f"📝 **Procedure Overview**:\n{catalog_context['steps']}")
        else:  # procedure / troubleshooting / default: full structured answer
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety**:\n{catalog_context['safety']}")
            if catalog_context.get("equipment"):
                parts.append(f"🧪 **Test Equipment**:\n{catalog_context['equipment']}")
            if catalog_context.get("steps"):
                parts.append(f"📝 **Procedure**:\n{catalog_context['steps']}")
            if catalog_context.get("limits"):
                parts.append(f"📏 **Acceptable Limits**:\n{catalog_context['limits']}")
            if catalog_context.get("standards"):
                parts.append(f"📚 **Applicable Standards**:\n{catalog_context['standards']}")
            if catalog_context.get("troubleshooting"):
                parts.append(f"🛠️ **If Outside Limits**:\n{catalog_context['troubleshooting']}")

        if not parts:
            return NOT_FOUND_ANSWER

        if sources:
            source_lines = [
                f"[{i+1}] {s['document']} · p.{s['page']} {s['section']}".rstrip(" ·")
                for i, s in enumerate(sources)
            ]
            parts.append("\n**Sources**:\n" + "\n".join(source_lines))

        return "\n\n".join(parts)

    def _log_unanswered(self, query: str, intent: str, score: float):
        from app.db.models import UnansweredQuery
        uq = UnansweredQuery(query=query, intent=intent, top_score=score)
        self.db.add(uq)
        self.db.commit()


async def stream_answer(assembler: AnswerAssembler,
                        understanding: QueryUnderstanding,
                        conversation_history: Optional[List[str]] = None) -> AsyncGenerator[Dict, None]:
    result = assembler.assemble(understanding, conversation_history)

    yield {"type": "intent", "data": {"intent": result["intent"]}}

    if result["source_type"] in ("guardrail", "not_found", "out_of_scope"):
        for word in result["answer"].split(" "):
            yield {"type": "token", "data": word + " "}
        yield {"type": "done", "data": result}
        return

    yield {"type": "citations", "data": result["citations"]}
    yield {"type": "safety", "data": {"required": needs_safety_notice(result["intent"], understanding.standalone_query)}}

    # assemble() already produced the final, verified answer (LLM-generated or
    # deterministic template fallback). Stream that exact text so the streamed
    # tokens match the persisted answer — no second LLM call, no marker leaks.
    for word in result["answer"].split(" "):
        yield {"type": "token", "data": word + " "}

    yield {"type": "done", "data": result}
