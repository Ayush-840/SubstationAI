from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User, Message, Feedback
from app.core.security import get_current_user
from app.schemas import FeedbackRequest

router = APIRouter(prefix="/api", tags=["feedback"])


@router.post("/feedback")
def submit_feedback(request: FeedbackRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    message = db.query(Message).filter(Message.id == request.message_id).first()
    if not message:
        raise HTTPException(404, "Message not found")
    
    existing = db.query(Feedback).filter(
        Feedback.message_id == request.message_id,
        Feedback.user_id == current_user.id
    ).first()
    
    if existing:
        existing.rating = request.rating
        existing.comment = request.comment
    else:
        feedback = Feedback(
            message_id=request.message_id,
            user_id=current_user.id,
            rating=request.rating,
            comment=request.comment
        )
        db.add(feedback)
    
    db.commit()
    return {"ok": True}