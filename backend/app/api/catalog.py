from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, asc
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import Test, User
from app.core.security import get_current_user
from app.schemas import EquipmentClassResponse, TestResponse, TestDetailResponse
from app.catalog.lookup import CatalogLookup
from app.api.deps import ListingParams
from app.cache.redis_cache import (
    get_catalog_list,
    set_catalog_list,
    get_catalog_all_cached,
    set_catalog_all_cached,
    invalidate_catalog_cache,
)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _serialize_test(test) -> dict:
    """Convert SQLAlchemy Test model to dict for caching."""
    return {
        "id": test.id,
        "name": test.name,
        "aliases": test.aliases,
        "category": test.category,
        "purpose": test.purpose,
        "summary": test.summary,
    }


@router.get("/equipment", response_model=List[EquipmentClassResponse])
def get_equipment_classes(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    catalog = CatalogLookup(db)
    equipment = catalog.get_all_equipment()
    return equipment


@router.get("/tests", response_model=List[TestResponse])
def get_tests(
    listing: ListingParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Try cache first
    cached = get_catalog_list(
        equipment=listing.equipment,
        page=listing.page,
        page_size=listing.limit,
        sort=listing.sort,
        q=listing.q,
    )
    if cached:
        return cached

    catalog = CatalogLookup(db)

    if listing.equipment:
        equip = catalog.find_equipment(listing.equipment)
        if not equip:
            raise HTTPException(404, "Equipment class not found")
        query = db.query(Test).filter(Test.equipment_class_id == equip.id)
    else:
        query = db.query(Test)

    # Apply sorting (shared pagination/filtering/sorting dependency — Day 2 B).
    sort_col: str = "id"
    sort_desc: bool = False
    if listing.sort:
        if listing.sort.startswith("-"):
            sort_col = listing.sort[1:]
            sort_desc = True
        else:
            sort_col = listing.sort
    col = getattr(Test, sort_col, None)
    if col is None:
        col = Test.id
        sort_desc = False
    ordered = query.order_by(desc(col) if sort_desc else asc(col))

    # Apply pagination (shared dependency — Day 2 B).
    total = ordered.count()
    rows = ordered.offset(listing.offset).limit(listing.limit).all()

    # Serialize before caching
    serialized_rows = [_serialize_test(r) for r in rows]

    # Cache the result (fire and forget)
    set_catalog_list(
        equipment=listing.equipment,
        page=listing.page,
        page_size=listing.limit,
        sort=listing.sort,
        q=listing.q,
        data=serialized_rows,
    )

    return rows


@router.get("/tests/{test_id}", response_model=TestDetailResponse)
def get_test_detail(
    test_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
                "parameter": lim.parameter,
                "value": lim.value_text,
                "min": lim.min_val,
                "max": lim.max_val,
                "unit": lim.unit,
                "condition": lim.condition_note,
            }
            for lim in details["limits"]
        ],
        standards=[
            {
                "code": s["code"],
                "title": s["title"],
                "body": s["body"],
                "clause": s["clause"],
            }
            for s in details["standards"]
        ],
        safety=[{"text": s.text, "mandatory": s.mandatory} for s in details["safety"]],
        troubleshooting=[
            {
                "symptom": t.symptom,
                "cause": t.probable_cause,
                "action": t.recommended_action,
            }
            for t in details["troubleshooting"]
        ],
    )


@router.get("/search")
def search_tests(
    q: str,
    equipment: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    catalog = CatalogLookup(db)

    equip_id = None
    if equipment:
        equip = catalog.find_equipment(equipment)
        if equip:
            equip_id = equip.id

    tests = catalog.search_tests(q, equip_id)
    return [{"id": t.id, "name": t.name, "aliases": t.aliases} for t in tests]
