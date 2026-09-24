import re
from typing import List, Dict, Tuple
from app.catalog.lookup import CatalogLookup
from app.db.session import SessionLocal
from app.db.models import TestLimit, Source


class AnswerVerifier:
    def __init__(self, catalog_lookup=None):
        self.catalog = catalog_lookup
    
    def extract_citations(self, text: str) -> List[int]:
        pattern = r'\[(\d+)\]'
        return [int(m) for m in re.findall(pattern, text)]
    
    def extract_numbers_with_units(self, text: str) -> List[Tuple[str, str]]:
        pattern = r'(\d+(?:\.\d+)?)\s*([A-Za-zµΩ%°/]+)'
        matches = re.findall(pattern, text)
        return [(val, unit) for val, unit in matches]
    
    def verify_citations(self, text: str, provided_sources: List[Dict]) -> Tuple[bool, List[str]]:
        citations = self.extract_citations(text)
        issues = []
        
        for cite_num in citations:
            if cite_num > len(provided_sources) or cite_num < 1:
                issues.append(f"Citation [{cite_num}] references non-existent source")
        
        return len(issues) == 0, issues
    
    def verify_numbers(self, text: str, catalog_context: Dict, rag_context: List[Dict]) -> Tuple[bool, List[str]]:
        numbers = self.extract_numbers_with_units(text)
        if not numbers:
            return True, []
        
        issues = []
        allowed_values = set()
        
        for limit_text in catalog_context.get("limits", "").split("\n"):
            if limit_text.strip().startswith("-"):
                nums = self.extract_numbers_with_units(limit_text)
                for val, unit in nums:
                    allowed_values.add(f"{val} {unit}".lower())
        
        for ctx in rag_context:
            nums = self.extract_numbers_with_units(ctx.get("text", ""))
            for val, unit in nums:
                allowed_values.add(f"{val} {unit}".lower())
        
        for val, unit in numbers:
            key = f"{val} {unit}".lower()
            if key not in allowed_values:
                issues.append(f"Value '{val} {unit}' not found in sources")
        
        return len(issues) == 0, issues
    
    def verify_safety_notice(self, text: str, intent: str) -> Tuple[bool, str]:
        if intent in ["procedure", "troubleshooting", "safety"]:
            if "safety" not in text.lower() and "🦺" not in text:
                return False, "Safety notice missing from answer"
        return True, ""


def verify_answer(
    answer: str,
    intent: str,
    catalog_context: Dict,
    rag_context: List[Dict],
    sources: List[Dict]
) -> Tuple[str, bool, List[str]]:
    db = SessionLocal()
    try:
        catalog = CatalogLookup(db)
        verifier = AnswerVerifier(catalog)
        
        issues = []
        
        citation_ok, citation_issues = verifier.verify_citations(answer, sources)
        issues.extend(citation_issues)
        
        numbers_ok, number_issues = verifier.verify_numbers(answer, catalog_context, rag_context)
        issues.extend(number_issues)
        
        safety_ok, safety_issue = verifier.verify_safety_notice(answer, intent)
        if not safety_ok:
            issues.append(safety_issue)
        
        if not issues:
            return answer, True, []
        
        return answer, False, issues
    finally:
        db.close()