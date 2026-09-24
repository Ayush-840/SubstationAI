"""Entity recognition with a graceful fallback when spaCy is unavailable."""
from typing import Dict, List, Tuple
try:
    import spacy
    from spacy.matcher import PhraseMatcher
    _SPACY_OK = True
except Exception:  # pragma: no cover - heavy optional dependency
    spacy = None
    PhraseMatcher = None
    _SPACY_OK = False

from rapidfuzz import fuzz, process
from app.nlp.normalise import normalize_query


# Static fallback gazetteer: (canonical_name, [aliases]).
# Used when the DB is unavailable; the DB gazetteer takes priority when seeded.
FALLBACK_GAZETTEER: Dict[str, List[Tuple[str, List[str]]]] = {
    "equipment": [
        ("Power Transformer", ["transformer", "power trafo", "xfmr"]),
        ("Circuit Breaker", ["breaker", "cb", "vacuum breaker", "sf6 breaker"]),
        ("Reactor", ["shunt reactor", "series reactor"]),
        ("Instrument Transformer", ["ct", "pt", "cvt", "ct/pt", "current transformer",
                                    "potential transformer", "capacitive voltage transformer"]),
        ("Surge Arrester", ["arrester", "arrestor", "lightning arrester", "la"]),
    ],
    "test": [
        ("Insulation Resistance (IR) and Polarisation Index (PI)",
         ["insulation resistance", "ir test", "megger test", "pi test", "polarisation index"]),
        ("Winding Resistance", ["winding resistance test", "dc resistance"]),
        ("Dissolved Gas Analysis (DGA)", ["dga", "dissolved gas analysis", "oil gas analysis"]),
        ("Oil Breakdown Voltage (BDV) and Moisture", ["bdv test", "breakdown voltage", "oil bdv"]),
        ("Sweep Frequency Response Analysis (SFRA)", ["sfra", "frequency response"]),
        ("Contact Resistance (DLRO)", ["contact resistance", "dcrm", "dlro", "micro-ohm test"]),
        ("Timing Test (Contact Travel)", ["breaker timing", "timing test", "travel test"]),
        ("SF6 Gas Quality and Moisture", ["sf6 test", "sf6 moisture", "dew point"]),
        ("Ratio and Polarity Test", ["ratio test", "polarity test", "ct ratio"]),
        ("Tan Delta and Capacitance (Bushing/Insulation)", ["tan delta", "power factor test"]),
        ("Knee-Point Voltage (Protection CT)", ["knee point", "excitation curve"]),
        ("Leakage Current Measurement (Total and Resistive)", ["leakage current"]),
        ("Thermography (Arrester)", ["thermography", "thermal imaging"]),
    ],
    "parameter": [
        ("IR", []), ("PI", []), ("tan delta", []), ("capacitance", []), ("resistance", []),
        ("moisture", []), ("hydrogen", []), ("acetylene", []), ("leakage current", []),
        ("knee-point voltage", []), ("contact resistance", []), ("ratio error", []),
    ],
}


class EntityRecognizer:
    def __init__(self):
        self.nlp = None
        self.matcher = None
        self._gazetteer: Dict[str, List[str]] = {k: [] for k in FALLBACK_GAZETTEER}
        self._canonical_map: Dict[str, str] = {}
        self._initialized = False
        if _SPACY_OK:
            try:
                self.nlp = spacy.load("en_core_web_sm", exclude=["ner", "lemmatizer"])
                self.matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
            except Exception:
                self.nlp = None
                self.matcher = None

    def _register(self, category: str, canonical: str, aliases: List[str]):
        """Register a canonical term plus aliases; aliases map to the canonical."""
        if canonical not in self._gazetteer[category]:
            self._gazetteer[category].append(canonical)
        self._canonical_map.setdefault(canonical.lower(), canonical)
        for alias in aliases:
            if alias and alias not in self._gazetteer[category]:
                self._gazetteer[category].append(alias)
            if alias:
                self._canonical_map.setdefault(alias.lower(), canonical)

    def _load_static(self):
        for category, entries in FALLBACK_GAZETTEER.items():
            for canonical, aliases in entries:
                self._register(category, canonical, aliases)

    def _load_db(self) -> bool:
        """Load canonical names + aliases from the seeded catalog DB."""
        try:
            from app.db.session import SessionLocal
            from app.db.models import EquipmentClass, Test
        except Exception:
            return False
        try:
            db = SessionLocal()
        except Exception:
            return False
        try:
            for eq in db.query(EquipmentClass).all():
                self._register("equipment", eq.name, list(eq.aliases or []))
            for t in db.query(Test).all():
                self._register("test", t.name, list(t.aliases or []))
            return True
        except Exception:
            return False
        finally:
            db.close()

    def load_gazetteer(self):
        self._load_static()
        self._load_db()  # overrides static canonicals where both exist? no: setdefault keeps first.
        self._initialized = True

        if _SPACY_OK and self.nlp is not None and self.matcher is not None:
            for category, terms in self._gazetteer.items():
                patterns = [self.nlp.make_doc(term) for term in terms]
                self.matcher.add(category, patterns)

    def recognize(self, text: str) -> Dict[str, List[str]]:
        if not self._initialized:
            self.load_gazetteer()

        normalized = normalize_query(text)
        found: Dict[str, List[str]] = {"equipment": [], "test": [], "parameter": []}

        if self.nlp is not None and self.matcher is not None:
            doc = self.nlp(normalized)
            for match_id, start, end in self.matcher(doc):
                category = self.nlp.vocab.strings[match_id]
                matched_text = doc[start:end].text
                canonical = self._canonical_map.get(matched_text.lower(), matched_text)
                if canonical not in found[category]:
                    found[category].append(canonical)

        # Fuzzy fallback (applied when a category is still empty).
        # Match against canonical names AND aliases, then canonicalise the winner.
        for category in ("equipment", "test"):
            if found[category]:
                continue
            match = process.extractOne(
                normalized, self._gazetteer[category],
                scorer=fuzz.WRatio, score_cutoff=55,
            )
            if match:
                canonical = self._canonical_map.get(match[0].lower(), match[0])
                if canonical not in found[category]:
                    found[category].append(canonical)

        for term in self._gazetteer["parameter"]:
            if term.lower() in normalized and term not in found["parameter"]:
                found["parameter"].append(term)

        return found


entity_recognizer = EntityRecognizer()
