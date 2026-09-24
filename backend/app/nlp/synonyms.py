from typing import Dict, List
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
        
        words = text.lower().split()
        expanded = [self._synonyms.get(w, w) for w in words]
        return " ".join(expanded)

    def get_canonical(self, variant: str) -> str:
        if not self._loaded:
            self.load()
        return self._synonyms.get(variant.lower(), variant)


synonym_manager = SynonymManager()