from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import threading
from pathlib import Path
from app.db.session import get_db
from app.db.models import User, Document, DocumentStatus, UserRole, Chunk
from app.core.security import get_current_admin
from app.schemas import DocumentResponse, AnalyticsResponse
from app.rag.ingest import process_document
from app.core.paths import RAW_DOCS_DIR

router = APIRouter(prefix="/api/admin", tags=["admin"])

UPLOAD_DIR = RAW_DOCS_DIR


@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    title: str = Form(...),
    doc_type: Optional[str] = Form(None),
    equipment_class_id: Optional[int] = Form(None),
    standard_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    allowed_extensions = {".pdf", ".docx", ".txt"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(400, "Invalid file type. Allowed: PDF, DOCX, TXT")
    
    file_size = 0
    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(8192):
            file_size += len(chunk)
            buffer.write(chunk)
    
    max_size_mb = 25
    max_size = max_size_mb * 1024 * 1024
    if file_size > max_size:
        os.remove(file_path)
        raise HTTPException(400, f"File too large. Max size: {max_size_mb} MB")
    
    doc = Document(
        title=title,
        filename=file.filename,
        doc_type=doc_type,
        equipment_class_id=equipment_class_id,
        standard_id=standard_id,
        status=DocumentStatus.PROCESSING,
        uploaded_by=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    thread = threading.Thread(target=process_document, args=(doc.id,))
    thread.start()
    
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        doc_type=doc.doc_type,
        equipment_class_id=doc.equipment_class_id,
        status=doc.status,
        page_count=doc.page_count,
        created_at=doc.created_at
    )


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [
        DocumentResponse(
            id=d.id,
            title=d.title,
            filename=d.filename,
            doc_type=d.doc_type,
            equipment_class_id=d.equipment_class_id,
            status=d.status,
            page_count=d.page_count,
            created_at=d.created_at
        )
        for d in docs
    ]


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: int, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    
    # remove vector index entries and chunks first
    try:
        from app.rag.retriever import retriever
        retriever.remove_document_chunks(doc_id)
    except Exception:
        pass
    db.query(Chunk).filter(Chunk.document_id == doc_id).delete()
    
    file_path = UPLOAD_DIR / doc.filename
    if file_path.exists():
        os.remove(file_path)
    
    db.delete(doc)
    db.commit()
    return {"ok": True}


@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from app.db.models import Message, Feedback, UnansweredQuery
    from sqlalchemy import func
    
    total_queries = db.query(Message).filter(Message.role == "user").count()
    
    avg_rating = db.query(func.avg(Feedback.rating)).scalar() or 0
    
    unanswered = db.query(UnansweredQuery).count()
    unanswered_rate = unanswered / total_queries if total_queries > 0 else 0
    
    top_questions = db.query(
        Message.content,
        func.count(Message.id).label('count')
    ).filter(Message.role == "user").group_by(Message.content).order_by(func.count(Message.id).desc()).limit(10).all()
    
    top_q = [{"question": q, "count": c} for q, c in top_questions]
    
    unanswered_q = db.query(UnansweredQuery).order_by(UnansweredQuery.created_at.desc()).limit(20).all()
    unanswered_list = [
        {"query": u.query, "intent": u.intent, "score": u.top_score, "created_at": u.created_at}
        for u in unanswered_q
    ]
    
    return AnalyticsResponse(
        total_queries=total_queries,
        avg_rating=float(avg_rating),
        unanswered_rate=unanswered_rate,
        top_questions=top_q,
        unanswered_queries=unanswered_list
    )


@router.put("/catalog/tests/{test_id}")
def update_catalog_test(test_id: int, data: dict, current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    from app.db.models import Test, TestStep, TestEquipment, TestLimit, TestStandard, SafetyPrecaution, Troubleshooting
    
    test = db.query(Test).filter(Test.id == test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    
    for key, value in data.items():
        if hasattr(test, key):
            setattr(test, key, value)
    
    db.commit()
    return {"ok": True}