"""Load the YAML test catalog into the database."""
from pathlib import Path
from typing import List, Dict, Any
import yaml
from sqlalchemy.orm import Session
from app.db.models import (
    EquipmentClass, Test, TestStep, TestEquipment, TestLimit,
    Standard, TestStandard, SafetyPrecaution, Troubleshooting, Source, Synonym,
    Document, DocumentStatus, Chunk,
)
from app.core.paths import CATALOG_DIR, RAW_DOCS_DIR
from app.catalog.lookup import CatalogLookup, format_catalog_for_context
from app.db.session import SessionLocal


def load_yaml_catalog() -> List[Dict[str, Any]]:
    catalog = []
    for yaml_file in sorted(CATALOG_DIR.glob("*.yaml")):
        with open(yaml_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if data:
                catalog.append(data)
    return catalog


def load_standards(db: Session) -> None:
    """Register every standard referenced in the catalog files."""
    seen = set()
    for equip_data in load_yaml_catalog():
        for std in equip_data.get("standards", []):
            code = std.get("code")
            if not code or code in seen:
                continue
            seen.add(code)
            existing = db.query(Standard).filter(Standard.code == code).first()
            if not existing:
                db.add(Standard(
                    code=code,
                    title=std.get("title", code),
                    body=(std.get("body") or "IEC"),
                    scope_note=std.get("scope_note", ""),
                ))
    db.commit()


def load_synonyms(db: Session) -> None:
    """Seed the synonym table used for query expansion."""
    pairs = [
        # abbreviations
        ("insulation resistance", "IR", "abbreviation"),
        ("polarisation index", "PI", "abbreviation"),
        ("dissolved gas analysis", "DGA", "abbreviation"),
        ("sweep frequency response analysis", "SFRA", "abbreviation"),
        ("current transformer", "CT", "abbreviation"),
        ("potential transformer", "PT", "abbreviation"),
        ("capacitive voltage transformer", "CVT", "abbreviation"),
        ("on load tap changer", "OLTC", "abbreviation"),
        ("breakdown voltage", "BDV", "abbreviation"),
        ("insulation resistance", "megger", "test"),
        ("tan delta", "tan delta test", "test"),
        ("tan delta", "power factor test", "test"),
        ("tan delta", "dissipation factor", "test"),
        ("contact resistance", "DCRM", "test"),
        ("contact resistance", "micro-ohm test", "test"),
        ("contact resistance", "DLRO", "test"),
        ("contact resistance", "DC resistance test", "test"),
        ("Circuit Breaker", "breaker", "equipment"),
        ("Circuit Breaker", "cb", "equipment"),
        ("Circuit Breaker", "vacuum breaker", "equipment"),
        ("Circuit Breaker", "sf6 breaker", "equipment"),
        ("Power Transformer", "transformer", "equipment"),
        ("Power Transformer", "power trafo", "equipment"),
        ("Surge Arrester", "arrestor", "equipment"),
        ("Surge Arrester", "lightning arrester", "equipment"),
        ("Surge Arrester", "LA", "equipment"),
        ("Instrument Transformer", "CT/PT", "equipment"),
        ("Instrument Transformer", "CT PT CVT", "equipment"),
        ("Reactor", "shunt reactor", "equipment"),
    ]
    for canonical, variant, kind in pairs:
        exists = db.query(Synonym).filter(
            Synonym.canonical == canonical,
            Synonym.variant == variant,
            Synonym.kind == kind,
        ).first()
        if not exists:
            db.add(Synonym(canonical=canonical, variant=variant, kind=kind))
    db.commit()


def _get_or_create_source(db: Session, cache: dict, doc: Document | None,
                          ref: str | None, page: int | None = None,
                          section: str | None = None) -> int | None:
    """Create/reuse a Source row for a catalog reference string."""
    if not ref:
        return None
    key = (ref, page, section)
    if key in cache:
        return cache[key]
    src = Source(document_id=doc.id if doc else None, page=page,
                 section=section, url_or_ref=ref)
    db.add(src)
    db.flush()
    cache[key] = src.id
    return src.id


def load_catalog_to_db(db: Session) -> None:
    load_standards(db)
    load_synonyms(db)

    sample_docs = {}  # equipment name -> Document row (for source links)
    for name in ["Power Transformer", "Circuit Breaker"]:
        doc = db.query(Document).filter(Document.filename.startswith("sample_" + name.split()[0].lower())).first()
        if doc:
            sample_docs[name] = doc

    source_cache: dict = {}

    for equip_data in load_yaml_catalog():
        equip_name = equip_data["equipment_class"]
        equip = db.query(EquipmentClass).filter(EquipmentClass.name == equip_name).first()
        if not equip:
            equip = EquipmentClass(
                name=equip_name,
                aliases=equip_data.get("aliases", []),
                description=equip_data.get("description", ""),
            )
            db.add(equip)
            db.flush()
        else:
            equip.aliases = equip_data.get("aliases", [])
            equip.description = equip_data.get("description", "")

        doc = sample_docs.get(equip_name)

        for test_data in equip_data.get("tests", []):
            test_name = test_data["name"]
            test = db.query(Test).filter(
                Test.name == test_name,
                Test.equipment_class_id == equip.id,
            ).first()
            if not test:
                test = Test(
                    equipment_class_id=equip.id,
                    name=test_name,
                    aliases=test_data.get("aliases", []),
                    category=test_data.get("category", "routine"),
                    purpose=(test_data.get("purpose") or "").strip(),
                    frequency_note=test_data.get("frequency_note", ""),
                    summary=(test_data.get("summary") or "").strip(),
                )
                db.add(test)
                db.flush()

            for i, step_data in enumerate(test_data.get("steps", []), 1):
                existing_step = db.query(TestStep).filter(
                    TestStep.test_id == test.id,
                    TestStep.step_no == i,
                ).first()
                text = step_data["text"] if isinstance(step_data, dict) else str(step_data)
                stype = step_data.get("type", "action") if isinstance(step_data, dict) else "action"
                if existing_step:
                    existing_step.text = text
                    existing_step.step_type = stype
                else:
                    db.add(TestStep(test_id=test.id, step_no=i,
                                    step_type=stype, text=text))

            for item in test_data.get("equipment", []):
                name_i = item["instrument"]
                existing_eq = db.query(TestEquipment).filter(
                    TestEquipment.test_id == test.id,
                    TestEquipment.instrument_name == name_i,
                ).first()
                if not existing_eq:
                    db.add(TestEquipment(
                        test_id=test.id,
                        instrument_name=name_i,
                        spec_note=item.get("note", ""),
                        source_id=_get_or_create_source(db, source_cache, doc, item.get("source_ref")),
                    ))

            for limit_data in test_data.get("limits", []):
                param = limit_data["parameter"]
                existing_limit = db.query(TestLimit).filter(
                    TestLimit.test_id == test.id,
                    TestLimit.parameter == param,
                ).first()
                std = None
                if limit_data.get("standard_id"):
                    std = db.query(Standard).filter(Standard.code == limit_data["standard_id"]).first()
                ref = limit_data.get("source_ref") or limit_data.get("source")
                vals = {
                    "value_text": limit_data.get("value", ""),
                    "min_val": limit_data.get("min_val"),
                    "max_val": limit_data.get("max_val"),
                    "unit": limit_data.get("unit", ""),
                    "condition_note": limit_data.get("condition", ""),
                    "standard_id": std.id if std else None,
                    "verified_by": limit_data.get("verified_by", "sample-data"),
                }
                if existing_limit:
                    for k, v in vals.items():
                        setattr(existing_limit, k, v)
                    existing_limit.source_id = _get_or_create_source(db, source_cache, doc, ref)
                else:
                    db.add(TestLimit(
                        test_id=test.id,
                        parameter=param,
                        source_id=_get_or_create_source(db, source_cache, doc, ref),
                        **vals,
                    ))

            for std_ref in test_data.get("standards", []):
                code = std_ref if isinstance(std_ref, str) else std_ref.get("code")
                std = db.query(Standard).filter(Standard.code == code).first()
                if not std:
                    continue
                clause = std_ref.get("clause", "") if isinstance(std_ref, dict) else ""
                exists = db.query(TestStandard).filter(
                    TestStandard.test_id == test.id,
                    TestStandard.standard_id == std.id,
                ).first()
                if not exists:
                    db.add(TestStandard(test_id=test.id, standard_id=std.id, clause_note=clause))

            for safety_data in test_data.get("safety", []):
                text = safety_data if isinstance(safety_data, str) else safety_data.get("text", "")
                if not text:
                    continue
                exists = db.query(SafetyPrecaution).filter(
                    SafetyPrecaution.test_id == test.id,
                    SafetyPrecaution.text == text,
                ).first()
                if not exists:
                    db.add(SafetyPrecaution(
                        scope="test",
                        test_id=test.id,
                        text=text,
                        mandatory=safety_data.get("mandatory", True) if isinstance(safety_data, dict) else True,
                        source_id=_get_or_create_source(db, source_cache, doc,
                                                        safety_data.get("source_ref") if isinstance(safety_data, dict) else None),
                    ))

            for ts_data in test_data.get("troubleshooting", []):
                symptom = ts_data["symptom"]
                exists = db.query(Troubleshooting).filter(
                    Troubleshooting.test_id == test.id,
                    Troubleshooting.symptom == symptom,
                ).first()
                if not exists:
                    db.add(Troubleshooting(
                        test_id=test.id,
                        symptom=symptom,
                        probable_cause=ts_data["cause"],
                        recommended_action=ts_data["action"],
                        source_id=_get_or_create_source(db, source_cache, doc, ts_data.get("source_ref")),
                    ))

        for safety_data in equip_data.get("general_safety", []):
            text = safety_data if isinstance(safety_data, str) else safety_data.get("text", "")
            if not text:
                continue
            exists = db.query(SafetyPrecaution).filter(
                SafetyPrecaution.equipment_class_id == equip.id,
                SafetyPrecaution.scope == "equipment",
                SafetyPrecaution.text == text,
            ).first()
            if not exists:
                db.add(SafetyPrecaution(
                    scope="equipment",
                    equipment_class_id=equip.id,
                    text=text,
                    mandatory=True,
                ))

    db.commit()

    try:
        n = index_catalog_chunks()
        if n:
            print(f"Indexed {n} catalog test chunks into the vector store")
    except Exception:
        # Retrieval indexing is optional; catalog answers work without it.
        pass


def _get_catalog_document(db: Session) -> Document:
    """Get or create the synthetic Document that backs catalog chunks."""
    doc = db.query(Document).filter(Document.doc_type == "catalog").first()
    if not doc:
        doc = Document(
            title="Test Catalog",
            filename="test_catalog.yaml",
            doc_type="catalog",
            status=DocumentStatus.READY,
            page_count=1,
        )
        db.add(doc)
        db.commit()
    return doc


def build_catalog_chunks(db: Session) -> List[Chunk]:
    """Create one retrievable Chunk row per catalog test.

    Each chunk packs the test's purpose, equipment, steps, limits, standards,
    safety and troubleshooting text, tagged with its equipment class and test
    ids so retrieval filters and citations work. Rows live under the synthetic
    "Test Catalog" document, so every downstream path (BM25 DB lookup,
    citation building, equipment filters) behaves exactly like document chunks.
    """
    cat_doc = _get_catalog_document(db)

    # Idempotent re-seed: drop previous catalog chunks (DB rows here; the
    # caller handles vector-store cleanup via replace_document_chunks).
    db.query(Chunk).filter(Chunk.document_id == cat_doc.id).delete()

    chunks: List[Chunk] = []
    for equip in db.query(EquipmentClass).all():
        for test in db.query(Test).filter(Test.equipment_class_id == equip.id).all():
            ctx = format_catalog_for_context(CatalogLookup(db), test.id)
            if not ctx:
                continue
            parts = [
                f"Test Catalog: {ctx['equipment_class']} — {ctx['test_name']}",
                f"Purpose: {ctx['purpose']}" if ctx.get("purpose") else "",
                f"Test equipment: {ctx['equipment']}" if ctx.get("equipment") else "",
                f"Procedure: {ctx['steps']}" if ctx.get("steps") else "",
                f"Acceptable limits: {ctx['limits']}" if ctx.get("limits") else "",
                f"Applicable standards: {ctx['standards']}" if ctx.get("standards") else "",
                f"Safety: {ctx['safety']}" if ctx.get("safety") else "",
                f"Troubleshooting: {ctx['troubleshooting']}" if ctx.get("troubleshooting") else "",
            ]
            text = "\n".join(p for p in parts if p)
            chunks.append(Chunk(
                document_id=cat_doc.id,
                page_start=None,
                page_end=None,
                section_title=f"Test Catalog — {ctx['equipment_class']}: {ctx['test_name']}",
                text=text,
                equipment_class_id=equip.id,
                test_id=test.id,
                chunk_index=0,
                token_count=len(text.split()),
            ))
    db.add_all(chunks)
    db.commit()
    return chunks


def index_catalog_chunks() -> int:
    """Embed + index catalog chunks into the vector store; no-op when heavy
    deps are unavailable. Re-seeding replaces the previous catalog vectors."""
    try:
        from app.rag.retriever import retriever
    except Exception:
        return 0
    if not retriever.enabled:
        return 0

    db = SessionLocal()
    try:
        cat_doc = _get_catalog_document(db)
        chunks = build_catalog_chunks(db)
        retriever.replace_document_chunks(cat_doc.id, chunks)
        return len(chunks)
    finally:
        db.close()


def register_sample_documents(db: Session) -> None:
    """Register the bundled sample SOP text files as ready documents."""
    for f in sorted(RAW_DOCS_DIR.glob("*.txt")):
        doc = db.query(Document).filter(Document.filename == f.name).first()
        if doc:
            continue
        db.add(Document(
            title=f.stem.replace("_", " ").title(),
            filename=f.name,
            doc_type="sample SOP",
            status=DocumentStatus.READY,
            page_count=1,
        ))
    db.commit()


def validate_catalog(db: Session) -> List[str]:
    errors: List[str] = []
    limits_without_source = db.query(TestLimit).filter(TestLimit.source_id.is_(None)).all()
    for limit in limits_without_source:
        test = db.query(Test).filter(Test.id == limit.test_id).first()
        equip = db.query(EquipmentClass).filter(EquipmentClass.id == test.equipment_class_id).first()
        errors.append(f"Limit without source: {equip.name} - {test.name} - {limit.parameter}")

    tests_without_steps = db.query(Test).filter(~Test.steps.any()).all()
    for test in tests_without_steps:
        equip = db.query(EquipmentClass).filter(EquipmentClass.id == test.equipment_class_id).first()
        errors.append(f"Test without steps: {equip.name} - {test.name}")
    return errors


if __name__ == "__main__":
    db = SessionLocal()
    try:
        load_catalog_to_db(db)
        errors = validate_catalog(db)
        if errors:
            print("Validation errors:")
            for e in errors:
                print(f"  - {e}")
        else:
            print("Catalog loaded and validated successfully")
    finally:
        db.close()
