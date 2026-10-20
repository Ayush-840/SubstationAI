"""Feedback endpoints (Day 4 B).

MongoDB is the system of record for votes — ``feedback.message_id`` is stored
as the mirrored message's ObjectId so a later ``$lookup`` type-matches (TRD
§3.1). The SQLite ``feedback`` table is kept as a best-effort mirror because
admin analytics still aggregates from it, and it is the only store while
MongoDB is down.
"""

import logging

from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.mongo import get_mongo
from app.db.mongo_repos import FeedbackRepo, MessageNotFound
from app.db.models import User, Message, Feedback
from app.core.security import get_current_user
from app.schemas import FeedbackBody, FeedbackRequest

router = APIRouter(prefix="/api", tags=["feedback"])
logger = logging.getLogger(__name__)


def _message_exists_in_sql(db: Session, message_id: int) -> bool:
    return (
        db.query(Message.id).filter(Message.id == message_id).first() is not None
    )


def _mirror_feedback_to_sql(
    db: Session, *, message_id: int, user_id: int, rating: int, comment: str | None
) -> None:
    """Keep the SQLite copy in step with the Mongo document (analytics reads it)."""
    try:
        existing = (
            db.query(Feedback)
            .filter(
                Feedback.message_id == message_id,
                Feedback.user_id == user_id,
            )
            .first()
        )
        if existing:
            existing.rating = rating
            existing.comment = comment
        else:
            db.add(
                Feedback(
                    message_id=message_id,
                    user_id=user_id,
                    rating=rating,
                    comment=comment,
                )
            )
        db.commit()
    except Exception:
        logger.warning("SQLite feedback mirror failed", exc_info=True)
        db.rollback()


async def _submit_feedback(
    message_id,
    *,
    rating: int,
    comment: str | None,
    current_user: User,
    db: Session,
    mongo_db,
) -> dict:
    sql_id = int(message_id) if str(message_id).isdigit() else None

    if mongo_db is not None:
        try:
            stored = await FeedbackRepo(mongo_db).upsert_one(
                message_id, user_id=current_user.id, rating=rating, comment=comment
            )
        except InvalidId:
            raise HTTPException(400, "Invalid message id")
        except MessageNotFound:
            # Mongo may simply lag the SQLite row (partial mirror); fall
            # through to the SQL store instead of losing the vote.
            pass
        else:
            if sql_id is not None and _message_exists_in_sql(db, sql_id):
                _mirror_feedback_to_sql(
                    db,
                    message_id=sql_id,
                    user_id=current_user.id,
                    rating=rating,
                    comment=comment,
                )
            return {"ok": True, "message_id": stored["message_id"]}

    if sql_id is None or not _message_exists_in_sql(db, sql_id):
        raise HTTPException(404, "Message not found")
    _mirror_feedback_to_sql(
        db,
        message_id=sql_id,
        user_id=current_user.id,
        rating=rating,
        comment=comment,
    )
    return {"ok": True, "message_id": sql_id}


@router.post("/messages/{message_id}/feedback")
async def submit_feedback(
    message_id: str,
    body: FeedbackBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    """Upsert the caller's vote on one message (Mongo-backed, SQL fallback)."""
    return await _submit_feedback(
        message_id,
        rating=body.rating,
        comment=body.comment,
        current_user=current_user,
        db=db,
        mongo_db=mongo_db,
    )


@router.post("/feedback")
async def submit_feedback_legacy(
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    """Legacy body shape kept for the eval harness — same handler as above."""
    return await _submit_feedback(
        request.message_id,
        rating=request.rating,
        comment=request.comment,
        current_user=current_user,
        db=db,
        mongo_db=mongo_db,
    )
