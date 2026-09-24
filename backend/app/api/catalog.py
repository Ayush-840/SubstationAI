from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import EquipmentClass, Test, User
from app.core.security import get_current_user
from app.schemas import EquipmentClassResponse, TestResponse, TestDetailResponse
from app.catalog.lookup import CatalogLookup

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/equipment", response_model=List[EquipmentClassResponse])
def get_equipment_classes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog = CatalogLookup(db)
    equipment = catalog.get_all_equipment()
    return equipment


@router.get("/tests", response_model=List[TestResponse])
def get_tests(equipment: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog = CatalogLookup(db)
    
    if equipment:
        equip = catalog.find_equipment(equipment)
        if not equip:
            raise HTTPException(404, "Equipment class not found")
        tests = catalog.get_tests_for_equipment(equip.id)
    else:
        tests = db.query(Test).all()
    
    return tests


@router.get("/tests/{test_id}", response_model=TestDetailResponse)
def get_test_detail(test_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog = CatalogLookup(db)
    details = catalog.get_test_with_details(test_id)
    
    if not details:
        raise HTTPException(404, "Test not found")
    
    test = details["test"]
    
    return TestDetailResponse(
        id=test.id,
        name=test.name,
        aliases=test.aliases,
        category=test.category,
        purpose=test.purpose,
        summary=test.summary,
        steps=[
            {"step_no": s.step_no, "type": s.step_type, "text": s.text}
            for s in details["steps"]
        ],
        equipment=[
            {"instrument": e.instrument_name, "spec": e.spec_note}
            for e in details["equipment"]
        ],
        limits=[
            {
                "parameter": l.parameter,
                "value": l.value_text,
                "min": l.min_val,
                "max": l.max_val,
                "unit": l.unit,
                "condition": l.condition_note
            }
            for l in details["limits"]
        ],
        standards=[
            {"code": s["code"], "title": s["title"], "body": s["body"], "clause": s["clause"]}
            for s in details["standards"]
        ],
        safety=[
            {"text": s.text, "mandatory": s.mandatory}
            for s in details["safety"]
        ],
        troubleshooting=[
            {"symptom": t.symptom, "cause": t.probable_cause, "action": t.recommended_action}
            for t in details["troubleshooting"]
        ]
    )


@router.get("/search")
def search_tests(q: str, equipment: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    catalog = CatalogLookup(db)
    
    equip_id = None
    if equipment:
        equip = catalog.find_equipment(equipment)
        if equip:
            equip_id = equip.id
    
    tests = catalog.search_tests(q, equip_id)
    return [{"id": t.id, "name": t.name, "aliases": t.aliases} for t in tests]