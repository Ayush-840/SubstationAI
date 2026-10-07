import re
from typing import Dict
from app.db.session import SessionLocal
from app.db.models import Synonym


class SynonymManager:
    def __init__(self):
        self._synonyms: Dict[str, str] = {}
        self._loaded = False

    def load(self):
        db = SessionLocal()
        try:
            synonyms = db.query(Synonym).all()
            for s in synonyms:
                self._synonyms[s.variant.lower()] = s.canonical
            self._loaded = True
        finally:
            db.close()

    def expand(self, text: str) -> str:
        if not self._loaded:
            self.load()
        if not self._synonyms:
            return text

        # Longest-phrase-first so "circuit breaker" is not rewritten as
        # "circuit Circuit Breaker" via a single-word variant match.
        # Prefer multi-word variants first, then single words.
        variants = sorted(self._synonyms.keys(), key=len, reverse=True)
        result = text
        for variant in variants:
            if " " not in variant:
                continue
            pattern = re.compile(rf"\b{re.escape(variant)}\b", re.IGNORECASE)
            result = pattern.sub(self._synonyms[variant], result)

        words = result.split()
        expanded = []
        for w in words:
            stripped = w.strip(".,;:!?()[]{}\"'")
            canon = self._synonyms.get(stripped.lower())
            if canon:
                # Keep surrounding punctuation attached to the canonical form.
                prefix = w[: len(w) - len(w.lstrip(".,;:!?()[]{}\"'"))]
                suffix = w[len(w.rstrip(".,;:!?()[]{}\"'")) :]
                expanded.append(f"{prefix}{canon}{suffix}")
            else:
                expanded.append(w)
        return " ".join(expanded)

    def get_canonical(self, variant: str) -> str:
        if not self._loaded:
            self.load()
        return self._synonyms.get(variant.lower(), variant)


synonym_manager = SynonymManager()
