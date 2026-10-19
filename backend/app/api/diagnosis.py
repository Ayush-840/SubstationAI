import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.mongo import get_mongo
from app.db.mongo_repos import FaultLogRepo
from app.db.models import User, EquipmentClass, Troubleshooting
from app.core.security import get_current_user
from app.schemas import (
    DiagnosisRequest,
    DiagnosisResponse,
    DiagnosisCause,
    CheckResultRequest,
    CheckResultResponse,
    FaultLogDoc,
)
from app.catalog.lookup import CatalogLookup

router = APIRouter(prefix="/api", tags=["diagnosis", "result_check"])
logger = logging.getLogger(__name__)


async def _log_fault_to_mongo(
    mongo_db,
    *,
    user_id: int,
    equipment_class: str,
    symptoms: list[str],
    readings: dict | None,
    diagnosis: str,
    resolution: str,
) -> None:
    """Append the run to the ``fault_logs`` collection (Day 4 A).

    Unlike chat history there is no SQLite counterpart for fault diagnoses —
    MongoDB is the system of record here — so the write is awaited but kept
    best-effort: a Mongo hiccup logs a warning instead of failing the
    diagnosis the user is waiting on.
    """
    if mongo_db is None:
        logger.info("MongoDB unreachable; fault log not stored")
        return
    try:
        await FaultLogRepo(mongo_db).insert_one(
            user_id=user_id,
            equipment_class=equipment_class,
            symptoms=symptoms,
            readings=readings or {},
            diagnosis=diagnosis,
            resolution=resolution,
        )
    except Exception:
        logger.warning("MongoDB fault-log write failed", exc_info=True)


@router.post("/diagnosis", response_model=DiagnosisResponse)
async def diagnosis(
    request: DiagnosisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    equip = (
        db.query(EquipmentClass)
        .filter(EquipmentClass.id == request.equipment_class_id)
        .first()
    )
    if not equip:
        raise HTTPException(404, "Equipment class not found")

    catalog = CatalogLookup(db)
    tests = catalog.get_tests_for_equipment(equip.id)

    all_troubleshooting = []
    for test in tests:
        ts_records = (
            db.query(Troubleshooting).filter(Troubleshooting.test_id == test.id).all()
        )
        for ts in ts_records:
            all_troubleshooting.append(
                {
                    "test_name": test.name,
                    "symptom": ts.symptom,
                    "cause": ts.probable_cause,
                    "action": ts.recommended_action,
                    "source_id": ts.source_id,
                }
            )

    causes = []
    symptom_lower = request.symptoms.lower()

    for ts in all_troubleshooting:
        if any(word in ts["symptom"].lower() for word in symptom_lower.split()):
            causes.append(
                DiagnosisCause(
                    cause=f"[{ts['test_name']}] {ts['cause']}",
                    likelihood=0.8,
                    recommended_checks=[ts["action"]],
                    sources=[
                        {
                            "document": "Test Catalog",
                            "page": "N/A",
                            "section": ts["symptom"],
                        }
                    ],
                )
            )

    if not causes:
        for ts in all_troubleshooting[:5]:
            causes.append(
                DiagnosisCause(
                    cause=f"[{ts['test_name']}] {ts['cause']}",
                    likelihood=0.5,
                    recommended_checks=[ts["action"]],
                    sources=[
                        {
                            "document": "Test Catalog",
                            "page": "N/A",
                            "section": ts["symptom"],
                        }
                    ],
                )
            )

    symptom_list = [
        part.strip() for part in request.symptoms.split(",") if part.strip()
    ] or [request.symptoms]
    await _log_fault_to_mongo(
        mongo_db,
        user_id=current_user.id,
        equipment_class=equip.name,
        symptoms=symptom_list,
        readings=request.readings,
        diagnosis="\n".join(cause.cause for cause in causes),
        resolution="\n".join(
            check for cause in causes for check in cause.recommended_checks
        ),
    )

    return DiagnosisResponse(causes=causes)


@router.get("/fault-logs")
async def list_fault_logs(
    current_user: User = Depends(get_current_user),
    mongo_db=Depends(get_mongo),
):
    """Diagnosis history from the ``fault_logs`` collection (newest first)."""
    if mongo_db is None:
        return []
    try:
        rows = await FaultLogRepo(mongo_db).find_many_by_user(current_user.id)
    except Exception:
        logger.warning("MongoDB fault-log read failed", exc_info=True)
        return []
    logs = []
    for row in rows:
        try:
            doc = FaultLogDoc.model_validate(row)
        except ValidationError:
            logger.warning("Skipping malformed fault-log document %r", row.get("_id"))
            continue
        logs.append(
            {
                "id": doc.id,
                "equipment_class": doc.equipment_class,
                "symptoms": doc.symptoms,
                "readings": doc.readings,
                "diagnosis": doc.diagnosis,
                "resolution": doc.resolution,
                "logged_at": doc.logged_at,
            }
        )
    return logs


@router.post("/check-result", response_model=CheckResultResponse)
def check_result(
    request: CheckResultRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.db.models import TestLimit

    limits = (
        db.query(TestLimit)
        .filter(
            TestLimit.test_id == request.test_id,
            TestLimit.parameter.ilike(request.parameter),
        )
        .all()
    )

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

    # Qualitative limit: criterion_text/value_text only, no numeric bounds
    # (e.g. "no visible tracking on the surface"). There is nothing to
    # compare numerically, so return the criterion directly.
    if matched_limit.min_val is None and matched_limit.max_val is None:
        return CheckResultResponse(
            status="see criterion",
            limit_value=matched_limit.value_text,
            source=f"Test Catalog (condition: {matched_limit.condition_note or 'general'})",
            troubleshooting=[],
        )

    status = "within limits"
    if (
        matched_limit.min_val is not None
        and request.measured_value < matched_limit.min_val
    ):
        status = "outside limits"
    elif (
        matched_limit.max_val is not None
        and request.measured_value > matched_limit.max_val
    ):
        status = "outside limits"
    elif (
        matched_limit.min_val is not None
        and abs(request.measured_value - matched_limit.min_val) / matched_limit.min_val
        < 0.1
    ):
        status = "borderline"
    elif (
        matched_limit.max_val is not None
        and abs(request.measured_value - matched_limit.max_val) / matched_limit.max_val
        < 0.1
    ):
        status = "borderline"

    troubleshooting = []
    if status == "outside limits":
        ts_records = (
            db.query(Troubleshooting)
            .filter(Troubleshooting.test_id == request.test_id)
            .all()
        )
        for ts in ts_records:
            troubleshooting.append(
                {
                    "symptom": ts.symptom,
                    "cause": ts.probable_cause,
                    "action": ts.recommended_action,
                }
            )

    return CheckResultResponse(
        status=status,
        limit_value=f"{matched_limit.value_text} {matched_limit.unit}",
        source=f"Test Catalog (condition: {matched_limit.condition_note or 'general'})",
        troubleshooting=troubleshooting,
    )
