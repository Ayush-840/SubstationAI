from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import time
from datetime import datetime, timezone
from bson import ObjectId

from app.db.session import get_db
from app.db.mongo import get_mongo
from app.db.mongo_repos import ConversationRepo, MessageRepo
from app.db.models import User, Conversation, Message, ConversationMode
from app.core.security import get_current_user
from app.schemas import ChatRequest, ChatResponse
from app.nlp.intent import intent_classifier
from app.rag.assembler import AnswerAssembler, stream_answer
router = APIRouter(prefix="/api/chat", tags=["chat"])


def _persist_to_mongo(
    conversation_id: int,
    user_id: int,
    title: str,
    mode: str,
    equipment: str | None,
    answer: str,
    intent: str | None,
    entities: dict | None,
    citations: list[dict] | None,
    confidence: float | None,
) -> None:
    """Additive MongoDB mirror of a completed chat answer (Day 3).

    Runs in a background anyio task so the synchronous ``chat`` endpoint
    stays fast and non-blocking. Failures are non-fatal — the SQLite write
    already succeeded.
    """

    async def _mirror() -> None:
        mongo_db = getattr(app.state, "mongo", None)
        if mongo_db is None:
            return
        try:
            msg_repo = MessageRepo(mongo_db)
            conv_repo = ConversationRepo(mongo_db)
            mongo_conv_id = str(conversation_id)
            existing = await conv_repo.find_by_id_and_user(
                mongo_conv_id, user_id
            )
            if existing is None:
                await conv_repo.insert_one(
                    user_id=user_id,
                    title=title or answer[:80],
                    mode=mode,
                    equipment=equipment,
                )
            await msg_repo.insert_one(
                conversation_id=mongo_conv_id,
                role="assistant",
                content=answer,
                intent=intent,
                entities=entities,
                citations=citations,
                confidence=confidence,
            )
        except Exception:
            pass

    async def _background_mirror() -> None:
        await _mirror()

    # Fire-and-forget: schedule the mirror on the same event loop without
    # blocking the sync endpoint. If scheduling fails, the request already
    # succeeded on SQLite, so we swallow the error.
    try:
        tg: TaskGroup | None = getattr(app.state, "_mongo_mirror_tg", None)
        if tg is None:
            return
        tg.start_soon(_background_mirror)
    except Exception:
        pass

CONVERSATION_FIELDS = (
    "_id",
    "user_id",
    "title",
    "mode",
    "equipment",
    "created_at",
    "updated_at",
)

MODE_MAP = {
    "qa": ConversationMode.QA,
    "procedure": ConversationMode.PROCEDURE,
    "diagnosis": ConversationMode.DIAGNOSIS,
    "learn": ConversationMode.LEARN,
}


def _get_or_create_conversation(
    db: Session, request: ChatRequest, user_id: int
) -> Conversation:
    if request.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.id == request.conversation_id,
                Conversation.user_id == user_id,
            )
            .first()
        )
        if not conversation:
            raise HTTPException(404, "Conversation not found")
        return conversation

    conversation = Conversation(
        user_id=user_id,
        title=request.message[:80],
        mode=MODE_MAP.get(request.mode, ConversationMode.QA),
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _get_or_create_conversation(db, request, current_user.id)

    user_msg = Message(
        conversation_id=conversation.id, role="user", content=request.message
    )
    db.add(user_msg)
    db.commit()

    history = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
        .all()
    )
    history_text = [f"{m.role}: {m.content}" for m in history[-8:]]

    understanding = intent_classifier.classify(request.message, history_text)
    if request.equipment and not understanding.equipment:
        understanding.equipment = request.equipment

    assembler = AnswerAssembler(db)
    started = time.perf_counter()

    async def event_generator():
        final: dict | None = None
        try:
            async for event in stream_answer(assembler, understanding, history_text):
                final = event.get("data") if event.get("type") == "done" else final
                yield f"data: {json.dumps({'type': event['type'], 'data': event['data']}, default=str)}\n\n"

            if final:
                latency_ms = int((time.perf_counter() - started) * 1000)
                assistant_msg = Message(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=final.get("answer", ""),
                    intent=final.get("intent"),
                    entities_json={
                        "equipment": final.get("equipment"),
                        "test": final.get("test"),
                    },
                    citations_json=final.get("citations", []),
                    confidence=final.get("confidence"),
                    latency_ms=latency_ms,
                )
                db.add(assistant_msg)
                db.commit()
                db.refresh(assistant_msg)

                try:
                    mongo_db = await get_mongo()
                    msg_repo = MessageRepo(mongo_db)
                    conv_repo = ConversationRepo(mongo_db)
                    mongo_conv_id = str(conversation.id)
                    # ensure a Mongo conversation header exists
                    existing = await conv_repo.find_by_id_and_user(
                        mongo_conv_id, current_user.id
                    )
                    if existing is None:
                        await conv_repo.insert_one(
                            user_id=current_user.id,
                            title=conversation.title or request.message[:80],
                            mode=request.mode,
                            equipment=request.equipment,
                        )
                    await msg_repo.insert_one(
                        conversation_id=mongo_conv_id,
                        role="assistant",
                        content=final.get("answer", ""),
                        intent=final.get("intent"),
                        entities={
                            "equipment": final.get("equipment"),
                            "test": final.get("test"),
                        },
                        citations=final.get("citations", []),
                        confidence=final.get("confidence"),
                    )
                except Exception:
                    pass
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': {'message': str(e)}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = _get_or_create_conversation(db, request, current_user.id)

    user_msg = Message(
        conversation_id=conversation.id, role="user", content=request.message
    )
    db.add(user_msg)
    db.commit()

    history = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
        .all()
    )
    history_text = [f"{m.role}: {m.content}" for m in history[-8:]]

    understanding = intent_classifier.classify(request.message, history_text)
    if request.equipment and not understanding.equipment:
        understanding.equipment = request.equipment

    started = time.perf_counter()
    assembler = AnswerAssembler(db)
    result = assembler.assemble(understanding, history_text)
    latency_ms = int((time.perf_counter() - started) * 1000)

    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result["answer"],
        intent=result["intent"],
        entities_json={
            "equipment": result.get("equipment"),
            "test": result.get("test"),
        },
        citations_json=result["citations"],
        confidence=result["confidence"],
        latency_ms=latency_ms,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    result["message_id"] = assistant_msg.id

    _persist_to_mongo(
        conversation_id=conversation.id,
        user_id=current_user.id,
        title=conversation.title or request.message[:80],
        mode=request.mode,
        equipment=request.equipment,
        answer=result["answer"],
        intent=result["intent"],
        entities={
            "equipment": result.get("equipment"),
            "test": result.get("test"),
        },
        citations=result["citations"],
        confidence=result["confidence"],
    )

    return ChatResponse(
        **result,
        conversation_id=conversation.id,
    )


@router.get("/conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    try:
        repo = ConversationRepo(mongo_db)
        rows = await repo.find_many_by_user(current_user.id)
        result: list[dict] = []
        msg_repo = MessageRepo(mongo_db)
        for row in rows:
            msg_count = await msg_repo.find_many_by_conversation(row["_id"])
            result.append(
                {
                    "id": row["_id"],
                    "title": row.get("title") or f"Conversation {row['_id'][:8]}",
                    "mode": row.get("mode", "qa"),
                    "created_at": row.get("created_at"),
                    "message_count": len(msg_count),
                }
            )
        return result
    except Exception:
        conversations = (
            db.query(Conversation)
            .filter(Conversation.user_id == current_user.id)
            .order_by(Conversation.created_at.desc())
            .all()
        )
        return [
            {
                "id": c.id,
                "title": c.title,
                "mode": c.mode.value,
                "created_at": c.created_at,
                "message_count": len(c.messages),
            }
            for c in conversations
        ]


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    try:
        repo = ConversationRepo(mongo_db)
        conv = await repo.find_by_id_and_user(conversation_id, current_user.id)
        if conv is None:
            raise HTTPException(404, "Conversation not found")
        messages = await MessageRepo(mongo_db).find_many_by_conversation(conversation_id)
        return {
            "id": conv["_id"],
            "title": conv.get("title"),
            "mode": conv.get("mode", "qa"),
            "created_at": conv.get("created_at"),
            "messages": [
                {
                    "id": m["_id"],
                    "role": m.get("role"),
                    "content": m.get("content", ""),
                    "intent": m.get("intent"),
                    "citations": m.get("citations", []),
                    "confidence": m.get("confidence"),
                    "created_at": m.get("created_at"),
                }
                for m in messages
            ],
        }
    except HTTPException:
        raise
    except Exception:
        conversation = (
            db.query(Conversation)
            .filter(
                Conversation.id == int(conversation_id),
                Conversation.user_id == current_user.id,
            )
            .first()
        )
        if not conversation:
            raise HTTPException(404, "Conversation not found")
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == int(conversation_id))
            .order_by(Message.created_at)
            .all()
        )
        return {
            "id": conversation.id,
            "title": conversation.title,
            "mode": conversation.mode.value,
            "created_at": conversation.created_at,
            "messages": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "intent": m.intent,
                    "citations": m.citations_json,
                    "confidence": m.confidence,
                    "created_at": m.created_at,
                }
                for m in messages
            ],
        }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    try:
        repo = ConversationRepo(mongo_db)
        deleted = await repo.delete_one(conversation_id, current_user.id)
        if deleted:
            await MessageRepo(mongo_db).delete_many_by_conversation(conversation_id)
            return {"ok": True}
    except Exception:
        pass

    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == int(conversation_id),
            Conversation.user_id == current_user.id,
        )
        .first()
    )
    if not conversation:
        raise HTTPException(404, "Conversation not found")

    db.delete(conversation)
    db.commit()
    return {"ok": True}
