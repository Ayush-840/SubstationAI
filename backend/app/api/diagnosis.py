from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import User, EquipmentClass, Troubleshooting
from app.core.security import get_current_user
from app.schemas import DiagnosisRequest, DiagnosisResponse, DiagnosisCause, CheckResultRequest, CheckResultResponse
from app.catalog.lookup import CatalogLookup

router = APIRouter(prefix="/api", tags=["diagnosis", "result_check"])


@router.post("/diagnosis", response_model=DiagnosisResponse)
def diagnosis(request: DiagnosisRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    equip = db.query(EquipmentClass).filter(EquipmentClass.id == request.equipment_class_id).first()
    if not equip:
        raise HTTPException(404, "Equipment class not found")
    
    catalog = CatalogLookup(db)
    tests = catalog.get_tests_for_equipment(equip.id)
    
    all_troubleshooting = []
    for test in tests:
        ts_records = db.query(Troubleshooting).filter(Troubleshooting.test_id == test.id).all()
        for ts in ts_records:
            all_troubleshooting.append({
                "test_name": test.name,
                "symptom": ts.symptom,
                "cause": ts.probable_cause,
                "action": ts.recommended_action,
                "source_id": ts.source_id
            })
    
    causes = []
    symptom_lower = request.symptoms.lower()
    
    for ts in all_troubleshooting:
        if any(word in ts["symptom"].lower() for word in symptom_lower.split()):
            causes.append(DiagnosisCause(
                cause=f"[{ts['test_name']}] {ts['cause']}",
                likelihood=0.8,
                recommended_checks=[ts['action']],
                sources=[{"document": "Test Catalog", "page": "N/A", "section": ts['symptom']}]
            ))
    
    if not causes:
        for ts in all_troubleshooting[:5]:
            causes.append(DiagnosisCause(
                cause=f"[{ts['test_name']}] {ts['cause']}",
                likelihood=0.5,
                recommended_checks=[ts['action']],
                sources=[{"document": "Test Catalog", "page": "N/A", "section": ts['symptom']}]
            ))
    
    return DiagnosisResponse(causes=causes)


@router.post("/check-result", response_model=CheckResultResponse)
def check_result(request: CheckResultRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.db.models import TestLimit
    
    limits = db.query(TestLimit).filter(
        TestLimit.test_id == request.test_id,
        TestLimit.parameter.ilike(request.parameter)
    ).all()
    
    if not limits:
        raise HTTPException(404, "No limits found for this test/parameter")
    
    matched_limit = None
    for limit in limits:
        if request.condition_note and limit.condition_note:
            if request.condition_note.lower() in limit.condition_note.lower():
                matched_limit = limit
                break
        elif not matched_limit:
            matched_limit = limit
    
    if not matched_limit:
        matched_limit = limits[0]
    
    status = "within limits"
    if matched_limit.min_val is not None and request.measured_value < matched_limit.min_val:
        status = "outside limits"
    elif matched_limit.max_val is not None and request.measured_value > matched_limit.max_val:
        status = "outside limits"
    elif matched_limit.min_val is not None and abs(request.measured_value - matched_limit.min_val) / matched_limit.min_val < 0.1:
        status = "borderline"
    elif matched_limit.max_val is not None and abs(request.measured_value - matched_limit.max_val) / matched_limit.max_val < 0.1:
        status = "borderline"
    
    troubleshooting = []
    if status == "outside limits":
        ts_records = db.query(Troubleshooting).filter(Troubleshooting.test_id == request.test_id).all()
        for ts in ts_records:
            troubleshooting.append({
                "symptom": ts.symptom,
                "cause": ts.probable_cause,
                "action": ts.recommended_action
            })
    
    return CheckResultResponse(
        status=status,
        limit_value=f"{matched_limit.value_text} {matched_limit.unit}",
        source=f"Test Catalog (condition: {matched_limit.condition_note or 'general'})",
        troubleshooting=troubleshooting
    )