import json
import logging
from typing import Literal, Optional
from pydantic import BaseModel
from app.core.config import get_settings
from app.nlp.normalise import normalize_query
from app.nlp.entities import entity_recognizer
from app.nlp.synonyms import synonym_manager

logger = logging.getLogger(__name__)

settings = get_settings()

IntentType = Literal[
    "procedure", "limits", "troubleshooting", "test_equipment",
    "standards", "safety", "purpose", "comparison", "out_of_scope"
]


class QueryUnderstanding(BaseModel):
    intent: IntentType = "procedure"
    equipment: Optional[str] = None
    test: Optional[str] = None
    parameter: Optional[str] = None
    language: str = "en"
    standalone_query: str = ""


INTENT_EXAMPLES = """
Examples:
1. "How to perform insulation resistance test on power transformer" -> {"intent": "procedure", "equipment": "Power Transformer", "test": "Insulation Resistance and Polarisation Index (PI)"}
2. "What is acceptable contact resistance for circuit breaker" -> {"intent": "limits", "equipment": "Circuit Breaker", "test": "Contact Resistance (DLRO)"}
3. "High leakage current on surge arrester what to do" -> {"intent": "troubleshooting", "equipment": "Surge Arrester", "test": "Leakage Current Measurement (Total and Resistive)"}
4. "Which instruments needed for SFRA" -> {"intent": "test_equipment", "equipment": "Power Transformer", "test": "Sweep Frequency Response Analysis (SFRA)"}
5. "Which standard covers DGA interpretation" -> {"intent": "standards", "equipment": "Power Transformer", "test": "Dissolved Gas Analysis (DGA)"}
6. "Safety precautions before CT testing" -> {"intent": "safety", "equipment": "Instrument Transformer"}
7. "Why is polarisation index measured" -> {"intent": "purpose", "equipment": "Power Transformer", "test": "Insulation Resistance and Polarisation Index (PI)"}
8. "Difference between IR and PI test" -> {"intent": "comparison", "equipment": "Power Transformer"}
9. "What is the weather today" -> {"intent": "out_of_scope"}
"""


def build_intent_prompt(query: str, context: list[str] | None = None) -> str:
    ctx = ""
    if context:
        ctx = f"Previous conversation:\n" + "\n".join(context[-4:]) + "\n\n"

    return f"""You are SubstationIQ's query understanding module. Classify the user's query into one of these intents:
- procedure: steps to carry out a test
- limits: acceptable values, typical values, criteria
- troubleshooting: probable causes and corrective actions for a problem
- test_equipment: instruments required for a test
- standards: which standard applies
- safety: safety precautions, PPE, isolation
- purpose: why a test is done, what it measures
- comparison: difference between tests or methods
- out_of_scope: not related to substation maintenance

{INTENT_EXAMPLES}

{ctx}Current query: "{query}"

Return ONLY valid JSON with fields: intent, equipment, test, parameter, language, standalone_query.
If equipment or test is unclear but needed, set to null and the system will ask for clarification.
standalone_query should be a self-contained version of the query with context resolved."""


# Ordered keyword rules: first match wins. troubleshooting must be tested before
# limits because queries like "high leakage what to do" also contain value words.
# Notes:
# - "fail" (not "fails") so failed/fails/failing/failure all match.
# - "what should i do" lives in troubleshooting and is checked before the
#   limits rule's "what should", which only fires on value questions
#   ("what should the polarisation index be?").
INTENT_RULES: list[tuple[str, list[str]]] = [
    ("troubleshooting", ["what to do", "what now", "what should i do", "probable cause",
                         "cause of", "causes", "root cause", "resolve", "fix",
                         "not working", "went wrong", "high ", "low ", "dropping", "rising",
                         "fail", "fault", "tripping", "alarm", "increased",
                         "above limit", "below limit", "out of spec", "out of tolerance",
                         "abnormal"]),
    ("test_equipment", ["which instrument", "what instrument", "equipment needed",
                        "equipment required", "instruments needed", "tools required",
                        "test set", "which meter"]),
    ("standards", ["which standard", "what standard", "standard covers", "standard applies",
                   "iec", "ieee", " cbip", " cea", "refer to standard"]),
    ("safety", ["safety", "precaution", "ppe", "permit to work", "permit-to-work",
                "isolation", "earthing", "grounding"]),
    ("limits", ["acceptable", "limit", "allowed value", "criteria", "typical value",
                "range", "threshold", "how much", "permissible",
                "what should", "expected value", "normal value", "nominal value"]),
    ("procedure", ["how to", "how do i", "how is", "how can i", "steps", "procedure",
                   "carry out", "conduct", "perform", "method of", "checklist"]),
    ("purpose", ["why ", "purpose of", "what does it measure", "significance of"]),
    ("comparison", ["difference between", " vs ", "versus", "compare"]),
]

DOMAIN_KEYWORDS = [
    "substation", "transformer", "breaker", "arrester", "arrestor", "reactor",
    "current transformer", "potential transformer", "capacitive voltage transformer",
    "insulation", "resistance", "contact", "dissolved gas analysis", "sweep frequency",
    "tan delta", "leakage", "winding", "ratio", "oil", "sf6", "bushing", "tap changer",
    "megger", "test", "safety", "maintenance", "earth", "isolation", "permit",
    "polarisation", "burden", "knee point", "switchgear", "protection relay",
]


class IntentClassifier:
    def __init__(self):
        self._model = None
        if settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._model = genai.GenerativeModel("gemini-1.5-flash")
            except Exception:
                logger.warning("Gemini init failed; using rule-based intent classification")

    def classify(self, query: str, conversation_history: list[str] | None = None) -> QueryUnderstanding:
        normalized = normalize_query(query)
        expanded = synonym_manager.expand(normalized)

        entities = entity_recognizer.recognize(expanded)

        if self._model:
            try:
                prompt = build_intent_prompt(expanded, conversation_history)
                response = self._model.generate_content(prompt)
                result = json.loads(response.text.strip().strip("```json").strip("```"))
                result["standalone_query"] = expanded
                if not entities["equipment"] and result.get("equipment"):
                    entities["equipment"] = [result["equipment"]]
                if not entities["test"] and result.get("test"):
                    entities["test"] = [result["test"]]
            except Exception:
                logger.exception("LLM intent classification failed; rule-based fallback used")

        return self._rule_based_fallback(expanded, entities)

    def _rule_based_fallback(self, query: str, entities: dict) -> QueryUnderstanding:
        q = f" {query.lower()} "

        intent = None
        for key, keywords in INTENT_RULES:
            if any(kw in q for kw in keywords):
                intent = key
                break

        if intent is None:
            # Query mentions domain terms but no clear intent -> treat as general procedure
            intent = "procedure" if any(kw in q for kw in DOMAIN_KEYWORDS) else "out_of_scope"

        if intent != "out_of_scope" and not any(kw in q for kw in DOMAIN_KEYWORDS):
            # An intent keyword alone (e.g. "how to boil an egg") is out of scope
            intent = "out_of_scope"

        equipment = (entities["equipment"][0] if entities["equipment"] else None)
        test = (entities["test"][0] if entities["test"] else None)
        parameter = (entities["parameter"][0] if entities["parameter"] else None)

        # Follow-up handling: "what about for a breaker?" style short queries
        if conversation_history_short(query) and equipment is None:
            equipment = resolve_context_equipment(query)

        return QueryUnderstanding(
            intent=intent,
            equipment=equipment,
            test=test,
            parameter=parameter,
            language="en",
            standalone_query=query,
        )


def conversation_history_short(query: str) -> bool:
    return len(query.split()) <= 6


def resolve_context_equipment(query: str) -> Optional[str]:
    """Placeholder for context resolution; the chat route passes history separately."""
    return None


intent_classifier = IntentClassifier()
