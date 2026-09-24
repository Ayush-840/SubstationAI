from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import copy
from app.db.session import get_db
from app.db.models import User, Test, ProcedureRun, TestStep
from app.core.security import get_current_user
from app.schemas import ProcedureStartRequest, ProcedureStepUpdate, ProcedureCompleteRequest, ProcedureRunResponse
from app.catalog.lookup import CatalogLookup

router = APIRouter(prefix="/api/procedures", tags=["procedures"])


@router.post("/start", response_model=ProcedureRunResponse)
def start_procedure(request: ProcedureStartRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    test = db.query(Test).filter(Test.id == request.test_id).first()
    if not test:
        raise HTTPException(404, "Test not found")
    
    steps = db.query(TestStep).filter(TestStep.test_id == request.test_id).order_by(TestStep.step_no).all()
    
    steps_state = {
        str(s.step_no): {
            "step_no": s.step_no,
            "type": s.step_type,
            "text": s.text,
            "done": False,
            "flagged": False,
            "note": ""
        }
        for s in steps
    }
    
    run = ProcedureRun(
        user_id=current_user.id,
        test_id=request.test_id,
        steps_state_json=steps_state
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    
    return ProcedureRunResponse(
        id=run.id,
        test_id=run.test_id,
        steps_state=run.steps_state_json,
        notes=run.notes,
        started_at=run.started_at,
        completed_at=run.completed_at
    )


@router.put("/{run_id}/step")
def update_step(run_id: int, update: ProcedureStepUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    run = db.query(ProcedureRun).filter(
        ProcedureRun.id == run_id,
        ProcedureRun.user_id == current_user.id
    ).first()
    if not run:
        raise HTTPException(404, "Procedure run not found")
    
    # Deep copy so SQLAlchemy detects the JSON mutation and persists it
    steps_state = copy.deepcopy(run.steps_state_json)
    step_key = str(update.step_no)
    if step_key not in steps_state:
        raise HTTPException(404, "Step not found")
    
    if update.step_no > 1:
        prev_key = str(update.step_no - 1)
        if prev_key in steps_state and not steps_state[prev_key]["done"]:
            raise HTTPException(400, "Previous step must be completed first")
    
    steps_state[step_key]["done"] = update.done
    steps_state[step_key]["flagged"] = update.flagged
    if update.note is not None:
        steps_state[step_key]["note"] = update.note
    
    run.steps_state_json = steps_state
    db.commit()
    
    return {"ok": True, "steps_state": steps_state}


@router.post("/{run_id}/complete", response_model=ProcedureRunResponse)
def complete_procedure(run_id: int, request: ProcedureCompleteRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import datetime
    
    run = db.query(ProcedureRun).filter(
        ProcedureRun.id == run_id,
        ProcedureRun.user_id == current_user.id
    ).first()
    if not run:
        raise HTTPException(404, "Procedure run not found")
    
    all_done = all(s["done"] for s in run.steps_state_json.values())
    if not all_done:
        raise HTTPException(400, "All steps must be completed")
    
    run.notes = request.notes
    run.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(run)
    
    return ProcedureRunResponse(
        id=run.id,
        test_id=run.test_id,
        steps_state=run.steps_state_json,
        notes=run.notes,
        started_at=run.started_at,
        completed_at=run.completed_at
    )


@router.get("/{run_id}/export")
def export_procedure_pdf(run_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from io import BytesIO
    
    run = db.query(ProcedureRun).filter(
        ProcedureRun.id == run_id,
        ProcedureRun.user_id == current_user.id
    ).first()
    if not run:
        raise HTTPException(404, "Procedure run not found")
    
    test = db.query(Test).filter(Test.id == run.test_id).first()
    equip = db.query(Test).filter(Test.id == run.test_id).first()
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    story.append(Paragraph(f"SubstationIQ - Guided Procedure Report", styles['Title']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Test: {test.name}", styles['Heading1']))
    story.append(Paragraph(f"Equipment: {test.equipment_class.name if test.equipment_class else 'Unknown'}", styles['Heading2']))
    story.append(Paragraph(f"User: {current_user.name}", styles['Normal']))
    story.append(Paragraph(f"Date: {run.started_at.strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    if run.completed_at:
        story.append(Paragraph(f"Completed: {run.completed_at.strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    story.append(Spacer(1, 12))
    
    story.append(Paragraph("Safety Checklist", styles['Heading2']))
    for step_key, step in sorted(run.steps_state_json.items(), key=lambda x: int(x[0])):
        if step["type"] == "safety":
            status = "✓" if step["done"] else "☐"
            flag = " ⚠" if step["flagged"] else ""
            story.append(Paragraph(f"{status} {step['text']}{flag}", styles['Normal']))
    
    story.append(Spacer(1, 12))
    story.append(Paragraph("Procedure Steps", styles['Heading2']))
    
    data = [["Step", "Type", "Instruction", "Done", "Flagged", "Notes"]]
    for step_key, step in sorted(run.steps_state_json.items(), key=lambda x: int(x[0])):
        data.append([
            str(step["step_no"]),
            step["type"],
            step["text"][:100] + "..." if len(step["text"]) > 100 else step["text"],
            "✓" if step["done"] else "☐",
            "⚠" if step["flagged"] else "",
            step.get("note", "")[:50]
        ])
    
    table = Table(data, colWidths=[0.5*inch, 0.7*inch, 3*inch, 0.5*inch, 0.5*inch, 1.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    story.append(table)
    
    if run.notes:
        story.append(Spacer(1, 12))
        story.append(Paragraph("Notes", styles['Heading2']))
        story.append(Paragraph(run.notes, styles['Normal']))
    
    story.append(Spacer(1, 24))
    story.append(Paragraph("Disclaimer: SubstationIQ is an informational aid. It does not replace official utility procedures, OEM instructions, work permits or trained personnel.", styles['Italic']))
    
    doc.build(story)
    buffer.seek(0)
    
    from fastapi.responses import Response
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=procedure_{test.name}_{run.id}.pdf"}
    )


@router.get("/runs", response_model=List[ProcedureRunResponse])
def get_procedure_runs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    runs = db.query(ProcedureRun).filter(ProcedureRun.user_id == current_user.id).order_by(ProcedureRun.started_at.desc()).all()
    return [
        ProcedureRunResponse(
            id=r.id,
            test_id=r.test_id,
            steps_state=r.steps_state_json,
            notes=r.notes,
            started_at=r.started_at,
            completed_at=r.completed_at
        )
        for r in runs
    ]