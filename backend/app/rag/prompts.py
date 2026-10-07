from typing import Dict, List
from app.core.config import get_settings
from app.rag.system_prompt import SYSTEM_PROMPT

settings = get_settings()

SAFETY_NOTICE = """🦺 **Safety First** - Before any work on live equipment:
1. Isolate the equipment from all energy sources
2. Apply earth/ground connections
3. Verify zero voltage/dead condition
4. Obtain valid permit-to-work
5. Wear appropriate PPE (insulated gloves, arc flash suit, safety glasses, etc.)
6. Follow site-specific safety procedures and OEM instructions"""

INTENT_TEMPLATES = {
    "procedure": {
        "sections": [
            "safety",
            "equipment",
            "steps",
            "limits",
            "standards",
            "troubleshooting",
        ],
        "prompt": """Answer the user's question about the test procedure.

Required sections in order:
1. **Safety**: {safety}
2. **Test Equipment Required**: {equipment}
3. **Procedure** (step by step): {steps}
4. **Acceptable Limits**: {limits}
5. **Applicable Standards**: {standards}
6. **If Values Are Outside Limits**: {troubleshooting}

Sources: {sources}

If any section has no information, write "Not found in available sources." for that section.""",
    },
    "limits": {
        "sections": ["safety", "limits", "standards"],
        "prompt": """Answer the user's question about acceptable limits.

Required sections:
1. **Safety**: {safety}
2. **Acceptable Limits**: {limits}
3. **Applicable Standards**: {standards}

Sources: {sources}

If limits are not found, clearly state: "Acceptable limits for this test were not found in the available sources." """,
    },
    "troubleshooting": {
        "sections": ["safety", "troubleshooting", "steps"],
        "prompt": """Answer the user's troubleshooting question.

Required sections:
1. **Safety**: {safety}
2. **Probable Causes and Actions**: {troubleshooting}
3. **Related Procedure Steps**: {steps}

Sources: {sources}

If troubleshooting info is not found, state: "No troubleshooting information found for this issue in available sources." """,
    },
    "test_equipment": {
        "sections": ["safety", "equipment"],
        "prompt": """Answer the user's question about test equipment needed.

Required sections:
1. **Safety**: {safety}
2. **Test Equipment Required**: {equipment}

Sources: {sources}""",
    },
    "standards": {
        "sections": ["standards"],
        "prompt": """Answer the user's question about applicable standards.

Required sections:
1. **Applicable Standards**: {standards}

Sources: {sources}""",
    },
    "safety": {
        "sections": ["safety"],
        "prompt": """Answer the user's question about safety precautions.

Required sections:
1. **Safety Precautions**: {safety}

Sources: {sources}""",
    },
    "purpose": {
        "sections": ["purpose", "steps"],
        "prompt": """Explain the purpose and basic procedure of the test.

Required sections:
1. **Purpose**: {purpose}
2. **Procedure Overview**: {steps}

Sources: {sources}""",
    },
    "comparison": {
        "sections": ["steps", "limits"],
        "prompt": """Compare the requested tests or methods.

Required sections:
1. **Comparison**: Provide a clear comparison based on the available information.

Sources: {sources}""",
    },
    "definition": {
        "sections": ["purpose"],
        "prompt": """Answer the definition / what-it-is question only.

Required sections:
1. **Definition**: Clear definition and main purpose of the equipment or concept.

Do NOT provide a maintenance procedure unless the user explicitly asked for one.
Do NOT attach unrelated equipment tests or generic safety procedure blocks.

Sources: {sources}""",
    },
    "maintenance_overview": {
        "sections": ["steps", "equipment"],
        "prompt": """List the applicable maintenance tests for this equipment class.

Required sections:
1. **Applicable Maintenance Checks**: Numbered list of relevant tests. For each, one brief line on what it checks.

Do NOT expand into a full single-test procedure unless the user asked for that specific test.
Note that applicability depends on equipment type/design.

Sources: {sources}""",
    },
    "out_of_scope": {
        "sections": [],
        "prompt": """The user's query is outside the scope of substation maintenance.
Respond politely that you can only help with substation maintenance topics.""",
    },
}


def build_prompt(
    intent: str,
    catalog_context: Dict[str, str],
    rag_context: List[Dict],
    sources: List[Dict],
    standalone_query: str,
) -> str:
    template = INTENT_TEMPLATES.get(intent, INTENT_TEMPLATES["procedure"])

    source_lines = []
    for i, src in enumerate(sources, 1):
        doc_name = src.get("document", "Unknown")
        page = src.get("page")
        has_page = page not in (None, -1, "", "—", "?", "None")
        section = src.get("section", "")
        loc = f" · p.{page}" if has_page else ""
        if section and (section == doc_name or section.startswith(f"{doc_name} —")):
            label = section
        elif section:
            label = f"{doc_name} {section}".strip()
        else:
            label = doc_name
        source_lines.append(f"[{i}] {label}{loc}")

    source_text = "\n".join(source_lines) if source_lines else "No sources"

    context_blocks = []
    for i, ctx in enumerate(rag_context, 1):
        meta = ctx.get("metadata") or {}
        doc = meta.get("document_id", "Unknown")
        page = meta.get("page_start")
        has_page = page not in (None, -1, "", "None")
        section = meta.get("section_title", "")
        loc = f", p.{page}" if has_page else ""
        context_blocks.append(f"[Context {i}] (Doc {doc}{loc}) {ctx['text'][:500]}")

    rag_text = (
        "\n\n".join(context_blocks)
        if context_blocks
        else "No document context available."
    )

    safety_with_notice = SAFETY_NOTICE
    if intent in ("definition", "comparison", "out_of_scope"):
        safety_with_notice = "Not applicable for this question type."
    elif catalog_context.get("safety"):
        safety_with_notice = (
            f"{SAFETY_NOTICE}\n\n**Test-Specific Safety:**\n{catalog_context['safety']}"
        )

    return f"""{SYSTEM_PROMPT}

CATALOG RECORDS (authoritative):
Test: {catalog_context.get('test_name', 'Unknown')}
Equipment: {catalog_context.get('equipment_class', 'Unknown')}
Purpose: {catalog_context.get('purpose', 'Not specified')}

Safety:
{catalog_context.get('safety', 'See general safety notice above')}

Equipment:
{catalog_context.get('equipment', 'Not specified')}

Steps:
{catalog_context.get('steps', 'Not specified')}

Limits:
{catalog_context.get('limits', 'Not specified')}

Standards:
{catalog_context.get('standards', 'Not specified')}

Troubleshooting:
{catalog_context.get('troubleshooting', 'Not specified')}

DOCUMENT CONTEXT (supporting):
{rag_text}

USER QUERY: {standalone_query}

{template['prompt'].format(
    safety=safety_with_notice,
    equipment=catalog_context.get('equipment', 'Not specified'),
    steps=catalog_context.get('steps', 'Not specified'),
    limits=catalog_context.get('limits', 'Not specified'),
    standards=catalog_context.get('standards', 'Not specified'),
    troubleshooting=catalog_context.get('troubleshooting', 'Not specified'),
    purpose=catalog_context.get('purpose', 'Not specified'),
    sources=source_text
)}"""
