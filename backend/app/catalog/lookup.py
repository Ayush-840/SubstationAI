from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.db.models import (
    EquipmentClass, Test, TestStep, TestEquipment, TestLimit,
    Standard, TestStandard, SafetyPrecaution, Troubleshooting, Source
)
from app.nlp.normalise import fuzzy_match
from app.nlp.entities import entity_recognizer


class CatalogLookup:
    def __init__(self, db: Session):
        self.db = db
    
    def find_equipment(self, name: str) -> Optional[EquipmentClass]:
        equip = self.db.query(EquipmentClass).filter(
            EquipmentClass.name.ilike(name)
        ).first()
        if equip:
            return equip
        
        all_equip = self.db.query(EquipmentClass).all()
        choices = []
        for e in all_equip:
            choices.append(e.name)
            choices.extend(e.aliases or [])
        
        match = fuzzy_match(name, choices)
        if match:
            for e in all_equip:
                if match == e.name or match in (e.aliases or []):
                    return e
        return None
    
    def find_test(self, equipment_id: int, name: str) -> Optional[Test]:
        test = self.db.query(Test).filter(
            Test.equipment_class_id == equipment_id,
            Test.name.ilike(name)
        ).first()
        if test:
            return test
        
        tests = self.db.query(Test).filter(Test.equipment_class_id == equipment_id).all()
        choices = []
        for t in tests:
            choices.append(t.name)
            choices.extend(t.aliases or [])
        
        match = fuzzy_match(name, choices)
        if match:
            for t in tests:
                if match == t.name or match in (t.aliases or []):
                    return t
        return None
    
    def get_test_with_details(self, test_id: int) -> Optional[Dict[str, Any]]:
        test = self.db.query(Test).filter(Test.id == test_id).first()
        if not test:
            return None
        
        equip = self.db.query(EquipmentClass).filter(EquipmentClass.id == test.equipment_class_id).first()
        
        steps = self.db.query(TestStep).filter(TestStep.test_id == test_id).order_by(TestStep.step_no).all()
        equipment = self.db.query(TestEquipment).filter(TestEquipment.test_id == test_id).all()
        limits = self.db.query(TestLimit).filter(TestLimit.test_id == test_id).all()
        
        standards = []
        for ts in self.db.query(TestStandard).filter(TestStandard.test_id == test_id).all():
            std = self.db.query(Standard).filter(Standard.id == ts.standard_id).first()
            if std:
                standards.append({
                    "code": std.code,
                    "title": std.title,
                    "body": std.body,
                    "clause": ts.clause_note
                })
        
        safety = self.db.query(SafetyPrecaution).filter(
            SafetyPrecaution.test_id == test_id
        ).all()
        
        troubleshooting = self.db.query(Troubleshooting).filter(
            Troubleshooting.test_id == test_id
        ).all()
        
        return {
            "test": test,
            "equipment_class": equip,
            "steps": steps,
            "equipment": equipment,
            "limits": limits,
            "standards": standards,
            "safety": safety,
            "troubleshooting": troubleshooting
        }
    
    def get_tests_for_equipment(self, equipment_id: int) -> List[Test]:
        return self.db.query(Test).filter(Test.equipment_class_id == equipment_id).all()
    
    def get_all_equipment(self) -> List[EquipmentClass]:
        return self.db.query(EquipmentClass).all()
    
    def get_equipment_by_id(self, equipment_id: int) -> Optional[EquipmentClass]:
        return self.db.query(EquipmentClass).filter(EquipmentClass.id == equipment_id).first()
    
    def search_tests(self, query: str, equipment_id: Optional[int] = None) -> List[Test]:
        q = self.db.query(Test)
        if equipment_id:
            q = q.filter(Test.equipment_class_id == equipment_id)
        
        all_tests = q.all()
        choices = {}
        for t in all_tests:
            choices[t.name] = t
            for alias in t.aliases or []:
                choices[alias] = t
        
        match = fuzzy_match(query, list(choices.keys()), threshold=70)
        if match:
            return [choices[match]]
        return []
    
    def get_safety_precautions(self, equipment_id: Optional[int] = None, test_id: Optional[int] = None) -> List[SafetyPrecaution]:
        q = self.db.query(SafetyPrecaution)
        if test_id:
            q = q.filter(SafetyPrecaution.test_id == test_id)
        elif equipment_id:
            q = q.filter(SafetyPrecaution.equipment_class_id == equipment_id)
        else:
            q = q.filter(SafetyPrecaution.scope == "general")
        return q.all()
    
    def get_source_details(self, source_id: int) -> Optional[Dict[str, Any]]:
        source = self.db.query(Source).filter(Source.id == source_id).first()
        if not source:
            return None
        doc = self.db.query(Source).filter(Source.document_id == source.document_id).first()
        return {
            "document_id": source.document_id,
            "page": source.page,
            "section": source.section,
            "url_or_ref": source.url_or_ref
        }


def format_catalog_for_context(lookup: CatalogLookup, test_id: int) -> Dict[str, Any]:
    details = lookup.get_test_with_details(test_id)
    if not details:
        return {}
    
    test = details["test"]
    equip = details["equipment_class"]
    
    safety_text = "\n".join([f"- {s.text}" for s in details["safety"]])
    if not safety_text:
        general_safety = lookup.get_safety_precautions(equipment_id=equip.id)
        safety_text = "\n".join([f"- {s.text}" for s in general_safety])
    
    equipment_list = [f"- {e.instrument_name}: {e.spec_note}" for e in details["equipment"]]
    
    steps = [f"{s.step_no}. {s.text}" for s in details["steps"]]
    
    limits = []
    for limit in details["limits"]:
        cond = f" ({limit.condition_note})" if limit.condition_note else ""
        std_ref = ""
        if limit.standard_id:
            std = lookup.db.query(Standard).filter(Standard.id == limit.standard_id).first()
            if std:
                std_ref = f" [{std.code}]"
        limits.append(f"- {limit.parameter}: {limit.value_text}{cond}{std_ref}")
    
    standards = [f"- {s['code']}: {s['title']} {s.get('clause', '')}" for s in details["standards"]]
    
    troubleshooting = []
    for ts in details["troubleshooting"]:
        troubleshooting.append(f"- Symptom: {ts.symptom}\n  Cause: {ts.probable_cause}\n  Action: {ts.recommended_action}")
    
    return {
        "test_name": test.name,
        "equipment_class": equip.name,
        "purpose": test.purpose,
        "safety": safety_text,
        "equipment": "\n".join(equipment_list),
        "steps": "\n".join(steps),
        "limits": "\n".join(limits),
        "standards": "\n".join(standards),
        "troubleshooting": "\n\n".join(troubleshooting),
        "source_count": len(details["steps"]) + len(details["equipment"]) + len(details["limits"])
    }