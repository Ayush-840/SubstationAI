"""Assembles the structured answer: guardrails -> catalog lookup -> retrieval ->
prompt -> generation -> verification, with a deterministic template fallback."""

import re
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
        ok, refusal = self.guardrails.check_input(understanding.standalone_query)
        if not ok:
            return self._result(
                understanding,
                answer=refusal,
                source_type="guardrail",
                citations=[],
                confidence=0.0,
            )

        equipment = None
        test = None

        if understanding.equipment:
            equipment = self.catalog.find_equipment(understanding.equipment)

        # Maintenance overview: list all tests for the equipment class —
        # never collapse onto a single retrieved test.
        if understanding.intent == "maintenance_overview" and equipment:
            return self._maintenance_overview_answer(understanding, equipment)

        if understanding.test and equipment:
            test = self.catalog.find_test(equipment.id, understanding.test)

        # Resolve a test when one was named, or for non-definition intents
        # (definitions describe the equipment class unless a test was requested).
        # Fuzzy search is restricted to the known equipment class so a Circuit
        # Breaker query can never collapse onto a Transformer test.
        need_test = test is None and (
            understanding.test or understanding.intent != "definition"
        )
        if need_test:
            tests = self.catalog.search_tests(
                understanding.test or understanding.standalone_query,
                equipment_id=equipment.id if equipment else None,
            )
            if tests:
                test = tests[0]
                if equipment is None:
                    equipment = self.catalog.get_equipment_by_id(
                        test.equipment_class_id
                    )

        # Definition questions: answer purpose/definition only, no forced procedure
        if understanding.intent == "definition":
            return self._definition_answer(understanding, equipment, test)

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

        rag_hits = reranker.rerank(
            understanding.standalone_query, rag_hits, settings.TOP_K_RERANK
        )

        top_score = 0.0
        if rag_hits:
            raw = rag_hits[0].get("rerank_score", rag_hits[0].get("score", 0)) or 0
            # Clamp to [0, 1] so raw CE logits / RRF fractions never surface
            top_score = min(1.0, max(0.0, float(raw)))

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
            self._log_unanswered(
                understanding.standalone_query, understanding.intent, top_score
            )
            return self._result(
                understanding,
                answer=NOT_FOUND_ANSWER,
                source_type="not_found",
                citations=[],
                confidence=round(top_score, 2),
            )

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
            return self._result(
                understanding,
                answer=out_refusal,
                source_type="guardrail",
                citations=sources,
                confidence=top_score,
            )

        if answer == TEMPLATE_MARKER or not answer.strip():
            answer = self._format_template_fallback(
                catalog_context, sources, understanding.intent
            )

        verified_answer, verified, verify_issues = verify_answer(
            answer,
            understanding.intent,
            catalog_context,
            rag_hits,
            sources,
        )

        if not verified and catalog_context:
            verified_answer = self._format_template_fallback(
                catalog_context, sources, understanding.intent
            )
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
            "confidence": self._calibrate_confidence(
                top_score, bool(catalog_context), understanding.intent
            ),
            "source_type": source_type,
        }

    @staticmethod
    def _calibrate_confidence(
        rerank_score: float, has_catalog: bool, intent: str
    ) -> float:
        """Multi-factor confidence in [0, 1]: rerank + catalog match + intent."""
        if intent == "out_of_scope":
            return 1.0
        intent_score = 1.0 if intent != "procedure" or has_catalog else 0.8
        catalog_bonus = 0.25 if has_catalog else 0.0
        combined = 0.6 * rerank_score + 0.15 * intent_score + catalog_bonus
        return round(min(1.0, max(0.0, combined)), 2)

    def _maintenance_overview_answer(
        self, understanding: QueryUnderstanding, equipment
    ) -> Dict:
        """List all catalog tests for the equipment — not a single procedure."""
        tests = self.catalog.get_tests_for_equipment(equipment.id)
        if not tests:
            return self._result(
                understanding,
                answer=(
                    f"I could not find catalogued maintenance tests for "
                    f"{equipment.name}. Please check the OEM manual or ask about "
                    "a specific test."
                ),
                source_type="not_found",
                citations=[],
                confidence=0.3,
            )

        lines = [
            f"**Applicable maintenance checks for {equipment.name}** "
            "(confirm applicability for your specific design/type):",
            "",
        ]
        for i, t in enumerate(tests, 1):
            purpose = (t.purpose or "").strip().split(".")[0]
            lines.append(f"{i}. **{t.name}**" + (f" — {purpose}" if purpose else ""))
        lines.append("")
        lines.append(
            "Ask for a specific test name to get its full procedure, limits, "
            "and safety requirements. Applicability depends on equipment "
            "type, design and maintenance schedule."
        )

        sources = [
            {
                "document": "Test Catalog",
                "page": "—",
                "section": f"Tests for {equipment.name}",
            }
        ]
        return {
            "intent": understanding.intent,
            "equipment": equipment.name,
            "test": None,
            "answer": "\n".join(lines),
            "sections": {"steps": "\n".join(lines)},
            "citations": sources,
            "confidence": 0.75,
            "source_type": "catalog",
        }

    def _definition_answer(
        self, understanding: QueryUnderstanding, equipment, test
    ) -> Dict:
        """Definition/purpose only — never a full maintenance procedure."""
        parts: List[str] = []
        if test and understanding.test and self._test_explicitly_named(understanding):
            # Explicit test named in the query — define that test's purpose
            ctx = format_catalog_for_context(self.catalog, test.id)
            if ctx.get("purpose"):
                parts.append(f"**Definition / Purpose**:\n{ctx['purpose']}")
            if ctx.get("test_name"):
                parts.append(
                    f"**Related test**: {ctx['test_name']} on "
                    f"{ctx.get('equipment_class', equipment.name if equipment else 'this equipment')}."
                )
            sources = [
                {
                    "document": "Test Catalog",
                    "page": "—",
                    "section": f"{ctx.get('equipment_class', '')}: {ctx.get('test_name', '')}",
                }
            ]
            confidence = 0.7
        elif equipment:
            desc = (equipment.description or "").strip()
            if desc:
                parts.append(f"**{equipment.name}**: {desc}")
            else:
                parts.append(
                    f"**{equipment.name}** is high-voltage substation equipment. "
                    "No extended catalog description is available; ask about a "
                    "specific test for procedure details."
                )
            tests = self.catalog.get_tests_for_equipment(equipment.id)
            if tests:
                names = ", ".join(t.name for t in tests[:6])
                parts.append(
                    f"\nCommon maintenance checks: {names}. "
                    "Ask about any of these for procedure, limits, or troubleshooting."
                )
            else:
                parts.append(
                    "\nAsk about a specific test (procedure, limits, troubleshooting) "
                    "for maintenance details."
                )
            sources = [
                {
                    "document": "Test Catalog",
                    "page": "—",
                    "section": equipment.name,
                }
            ]
            confidence = 0.7
        else:
            return self._result(
                understanding,
                answer=(
                    "Could you clarify which equipment you mean "
                    "(e.g. power transformer, circuit breaker, reactor, CT/PT, "
                    "surge arrester)? I'll then give a precise definition."
                ),
                source_type="clarification",
                citations=[],
                confidence=0.4,
            )

        if not parts:
            parts.append(
                "I need more information to define this accurately for your "
                "equipment. Please specify the equipment type."
            )

        return {
            "intent": understanding.intent,
            "equipment": equipment.name if equipment else None,
            "test": test.name if test else None,
            "answer": "\n\n".join(parts),
            "sections": {"purpose": "\n\n".join(parts)},
            "citations": sources,
            "confidence": confidence,
            "source_type": "catalog",
        }

    @staticmethod
    def _test_explicitly_named(understanding: QueryUnderstanding) -> bool:
        """True only if the user literally named the test (not a fuzzy guess)."""
        test = (understanding.test or "").strip().lower()
        if not test:
            return False
        q = understanding.standalone_query.lower()
        if test in q:
            return True
        # Also accept distinctive aliases/keywords from the test name itself.
        key = re.split(r"[()]", test)[0].strip()
        return bool(key) and key in q

    def _result(
        self,
        understanding: QueryUnderstanding,
        answer: str,
        source_type: str,
        citations: List[Dict],
        confidence: float,
    ) -> Dict:
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
        seen: set = set()  # identity keys: (doc_id, page) tuples and display strings

        def _add(source: Dict) -> None:
            section = source.get("section") or ""
            # Normalize ingest prefix so catalog + RAG rows collapse to one.
            norm_section = section
            for prefix in ("Test Catalog — ", "Test Catalog - ", "Test Catalog "):
                if norm_section.startswith(prefix):
                    norm_section = norm_section[len(prefix) :]
                    break
            display = (
                source.get("document"),
                str(source.get("page")),
                norm_section,
            )
            if display in seen:
                return
            seen.add(display)
            sources.append(source)

        for hit in rag_hits:
            chunk_id = hit.get("chunk_id")
            chunk = self.db.query(Chunk).filter(Chunk.id == chunk_id).first()
            if not chunk:
                continue
            doc = (
                self.db.query(Document).filter(Document.id == chunk.document_id).first()
            )
            key = (chunk.document_id, chunk.page_start)
            if key in seen:
                continue
            seen.add(key)
            page = chunk.page_start
            if page is None or page == -1:
                page = "—"  # never surface Page: None / Page: -1
            _add(
                {
                    "document": doc.title if doc else f"Chunk {chunk_id}",
                    "page": page,
                    "section": chunk.section_title or "",
                }
            )

        if catalog_context:
            eq = catalog_context.get("equipment_class", "")
            tn = catalog_context.get("test_name", "")
            section = f"{eq}: {tn}".strip(": ")
            _add({"document": "Test Catalog", "page": "—", "section": section})

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
            (
                "standards",
                ["**Applicable Standards", "Applicable Standards:", "Standards:"],
            ),
            (
                "troubleshooting",
                [
                    "**If Values",
                    "**If Outside",
                    "**Troubleshooting",
                    "Troubleshooting:",
                    "Causes and Actions:",
                ],
            ),
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

    def _format_template_fallback(
        self, catalog_context: Dict, sources: List[Dict], intent: str
    ) -> str:
        parts: List[str] = []

        if intent == "out_of_scope":
            return "I can only help with substation maintenance topics."

        if intent == "definition":
            if catalog_context.get("purpose"):
                parts.append(f"**Definition / Purpose**:\n{catalog_context['purpose']}")
            if catalog_context.get("test_name"):
                parts.append(
                    f"**Related test context**: {catalog_context['test_name']} "
                    f"on {catalog_context.get('equipment_class', 'this equipment')}. "
                    "Ask for a procedure or limits if you need maintenance details."
                )
        elif intent == "maintenance_overview":
            # Prefer multi-test listing over a single test's full procedure
            if catalog_context.get("equipment_class"):
                parts.append(
                    f"**Applicable maintenance checks for "
                    f"{catalog_context['equipment_class']}** (confirm for your "
                    "specific design/type):"
                )
            if catalog_context.get("test_name"):
                brief = catalog_context.get("purpose") or "Equipment-specific check."
                parts.append(f"1. {catalog_context['test_name']} — {brief}")
            if catalog_context.get("steps"):
                parts.append(
                    "\nAsk for a specific test name to get its full procedure, "
                    "limits, and safety requirements."
                )
        elif intent == "limits":
            if catalog_context.get("limits"):
                parts.append(f"📏 **Acceptable Limits**:\n{catalog_context['limits']}")
            if catalog_context.get("standards"):
                parts.append(
                    f"📚 **Applicable Standards**:\n{catalog_context['standards']}"
                )
        elif intent == "test_equipment":
            if catalog_context.get("equipment"):
                parts.append(f"🧪 **Test Equipment**:\n{catalog_context['equipment']}")
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety**:\n{catalog_context['safety']}")
        elif intent == "standards":
            if catalog_context.get("standards"):
                parts.append(
                    f"📚 **Applicable Standards**:\n{catalog_context['standards']}"
                )
        elif intent == "safety":
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety Precautions**:\n{catalog_context['safety']}")
        elif intent == "purpose":
            if catalog_context.get("purpose"):
                parts.append(f"**Purpose**:\n{catalog_context['purpose']}")
            if catalog_context.get("steps"):
                parts.append(f"📝 **Procedure Overview**:\n{catalog_context['steps']}")
        elif intent == "troubleshooting":
            # Symptom-first format: causes/checks before any procedure detail
            if catalog_context.get("troubleshooting"):
                parts.append(
                    f"🛠️ **Possible Causes and Actions**:\n{catalog_context['troubleshooting']}"
                )
            if catalog_context.get("limits"):
                parts.append(
                    f"📏 **Acceptable Limits** (for comparison):\n{catalog_context['limits']}"
                )
            if catalog_context.get("steps"):
                parts.append(
                    "\n**Related checks** (request the full procedure if needed):\n"
                    f"{catalog_context['steps']}"
                )
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety**:\n{catalog_context['safety']}")
        else:  # procedure / default: full structured answer
            if catalog_context.get("safety"):
                parts.append(f"🦺 **Safety**:\n{catalog_context['safety']}")
            if catalog_context.get("equipment"):
                parts.append(f"🧪 **Test Equipment**:\n{catalog_context['equipment']}")
            if catalog_context.get("steps"):
                parts.append(f"📝 **Procedure**:\n{catalog_context['steps']}")
            if catalog_context.get("limits"):
                parts.append(f"📏 **Acceptable Limits**:\n{catalog_context['limits']}")
            if catalog_context.get("standards"):
                parts.append(
                    f"📚 **Applicable Standards**:\n{catalog_context['standards']}"
                )
            if catalog_context.get("troubleshooting"):
                parts.append(
                    f"🛠️ **If Outside Limits**:\n{catalog_context['troubleshooting']}"
                )

        if not parts:
            return NOT_FOUND_ANSWER

        if sources:
            source_lines = []
            for i, s in enumerate(sources):
                page = s.get("page")
                has_page = page not in (None, -1, "", "—", "?")
                loc = f" · p.{page}" if has_page else ""
                doc = s.get("document") or ""
                section = s.get("section") or ""
                # Avoid "Test Catalog Test Catalog" when section_title already
                # embeds the document name from ingest.
                if section and (section == doc or section.startswith(f"{doc} —")):
                    label = section
                elif section:
                    label = f"{doc} {section}".strip()
                else:
                    label = doc
                source_lines.append(f"[{i+1}] {label}{loc}")
            parts.append("\n**Sources**:\n" + "\n".join(source_lines))

        return "\n\n".join(parts)

    def _log_unanswered(self, query: str, intent: str, score: float):
        from app.db.models import UnansweredQuery

        uq = UnansweredQuery(query=query, intent=intent, top_score=score)
        self.db.add(uq)
        self.db.commit()


async def stream_answer(
    assembler: AnswerAssembler,
    understanding: QueryUnderstanding,
    conversation_history: Optional[List[str]] = None,
) -> AsyncGenerator[Dict, None]:
    result = assembler.assemble(understanding, conversation_history)

    yield {"type": "intent", "data": {"intent": result["intent"]}}

    if result["source_type"] in ("guardrail", "not_found", "out_of_scope"):
        for word in result["answer"].split(" "):
            yield {"type": "token", "data": word + " "}
        yield {"type": "done", "data": result}
        return

    yield {"type": "citations", "data": result["citations"]}
    yield {
        "type": "safety",
        "data": {
            "required": needs_safety_notice(
                result["intent"], understanding.standalone_query
            )
        },
    }

    # assemble() already produced the final, verified answer (LLM-generated or
    # deterministic template fallback). Stream that exact text so the streamed
    # tokens match the persisted answer — no second LLM call, no marker leaks.
    for word in result["answer"].split(" "):
        yield {"type": "token", "data": word + " "}

    yield {"type": "done", "data": result}
