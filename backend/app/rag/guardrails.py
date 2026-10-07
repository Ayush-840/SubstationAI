import re
from typing import Tuple
from app.core.config import get_settings

settings = get_settings()

BYPASS_KEYWORDS = [
    r"bypass",
    r"override",
    r"disable.*safety",
    r"ignore.*interlock",
    r"defeat.*protection",
    r"short.*circuit.*protection",
    r"remove.*earth",
    r"work.*live",
    r"energiz.*without",
    r"test.*without.*isolation",
]

INJECTION_PATTERNS = [
    r"ignore.*previous.*instructions",
    r"forget.*system.*prompt",
    r"you are now",
    r"new instructions",
    r"override.*your.*rules",
    r"disregard.*safety",
    r"act as",
    r"pretend to be",
    r"simulate",
    r"roleplay",
    r"ignore.*standards",
    r"invent a value",
    r"invent.*limit",
    r"make up.*(value|limit)",
    r"universal limit even if",
    r"don't mention uncertainty",
    r"do not mention uncertainty",
    r"pretend.*(oem|manual|standard)",
]

UNIVERSAL_LIMIT_PATTERNS = [
    r"universal (contact resistance|limit|value|criterion|criteria|pass.?fail)",
    r"one (universal )?(value|limit) for every",
    r"one value for everything",
    r"every (circuit breaker|breaker|transformer|reactor|manufacturer|model)",
    r"all voltage classes",
    r"all ratings",
    r"regardless of (design|manufacturer|rating|model)",
    r"same (limit|value) for all",
    r"single universal",
]

UNIVERSAL_LIMIT_REFUSAL = (
    "There is no single universally applicable pass/fail value that can safely "
    "be applied to every piece of equipment. Acceptance should be based on the "
    "applicable OEM requirements, equipment design/rating, test method, and "
    "comparison with factory or historical results.\n\n"
    "To determine the applicable criterion, please provide: equipment type, "
    "manufacturer/model, voltage/current rating, test method, and applicable "
    "standard or OEM manual if available."
)


def check_universal_limit_request(text: str) -> bool:
    text_lower = text.lower()
    for pattern in UNIVERSAL_LIMIT_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def get_universal_limit_refusal() -> str:
    return UNIVERSAL_LIMIT_REFUSAL


SAFETY_TRIGGER_KEYWORDS = [
    "open",
    "close",
    "energise",
    "energize",
    "isolate",
    "test",
    "replace",
    "bushing",
    "secondary",
    "sf6",
    "discharge",
    "earth",
    "ground",
    "permit",
    "live",
    "voltage",
    "current",
    "switch",
    "breaker",
    "tap changer",
    "olTC",
    "bushing",
    "ct",
    "pt",
    "cvt",
]


def check_bypass_request(text: str) -> bool:
    text_lower = text.lower()
    for pattern in BYPASS_KEYWORDS:
        if re.search(pattern, text_lower):
            return True
    return False


def check_prompt_injection(text: str) -> bool:
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False


def needs_safety_notice(intent: str, query: str) -> bool:
    # Definition / overview questions must not get a forced safety block
    if intent in ("definition", "comparison", "out_of_scope", "purpose"):
        return False
    if intent in ["procedure", "troubleshooting", "safety", "maintenance_overview"]:
        # overview: safety only if the query itself is safety-flavoured
        if intent == "maintenance_overview":
            query_lower = query.lower()
            return any(
                k in query_lower for k in ("safety", "isolation", "permit", "ppe")
            )
        return True
    query_lower = query.lower()
    for keyword in SAFETY_TRIGGER_KEYWORDS:
        if keyword in query_lower:
            return True
    return False


def get_safety_refusal() -> str:
    return (
        "I can't help with bypassing safety devices, interlocks, or protection systems. "
        "These are critical for personnel safety and equipment protection. "
        "Please follow your utility's approved procedures and obtain proper permits."
    )


def get_injection_refusal() -> str:
    return "I can't process that request. Please ask a question related to substation maintenance."


def sanitize_output(text: str) -> str:
    return text


class Guardrails:
    def __init__(self):
        pass

    def check_input(self, query: str) -> Tuple[bool, str]:
        if check_prompt_injection(query):
            return False, get_injection_refusal()
        if check_bypass_request(query):
            return False, get_safety_refusal()
        if check_universal_limit_request(query):
            return False, get_universal_limit_refusal()
        return True, ""

    def check_output(self, text: str) -> Tuple[bool, str]:
        if check_bypass_request(text):
            return False, get_safety_refusal()
        return True, ""

    def requires_safety_notice(self, intent: str, query: str) -> bool:
        return needs_safety_notice(intent, query)
