import re
from rapidfuzz import process, fuzz

ABBREVIATIONS = {
    r"\bir\b": "insulation resistance",
    r"\bpi\b": "polarisation index",
    r"\bdga\b": "dissolved gas analysis",
    r"\bsfra\b": "sweep frequency response analysis",
    r"\btan\s*delta\b": "tan delta",
    r"\bpf\b": "power factor",
    r"\bct\b": "current transformer",
    r"\bpt\b": "potential transformer",
    r"\bcvt\b": "capacitive voltage transformer",
    r"\boltc\b": "on load tap changer",
    r"\bbdv\b": "breakdown voltage",
    r"\bmegger\b": "insulation resistance",
    r"\bcontact\s*resistance\b": "contact resistance",
    r"\bwinding\s*resistance\b": "winding resistance",
    r"\bturns\s*ratio\b": "turns ratio",
    r"\bleakage\s*current\b": "leakage current",
    r"\bthermal\s*image\b": "thermography",
    r"\bvibration\b": "vibration analysis",
}


def expand_abbreviations(text: str) -> str:
    result = text.lower()
    for pattern, replacement in ABBREVIATIONS.items():
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return result


def normalize_query(text: str) -> str:
    text = text.strip()
    text = expand_abbreviations(text)
    text = re.sub(r"\s+", " ", text)
    return text


def fuzzy_match(query: str, choices: list[str], threshold: int = 80) -> str | None:
    if not choices:
        return None
    match = process.extractOne(query, choices, scorer=fuzz.WRatio, score_cutoff=threshold)
    return match[0] if match else None
