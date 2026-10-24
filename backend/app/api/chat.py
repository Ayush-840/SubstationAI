from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import logging
import time
from datetime import datetime, timezone
import os

from app.db.session import get_db
from app.db.mongo import get_mongo
from app.db.mongo_repos import ConversationRepo, MessageRepo
from app.db.models import User, Conversation, Message, ConversationMode
from app.core.security import get_current_user
from app.core.security_middleware import get_limiter
from app.schemas import ChatRequest, ChatResponse, ConversationDoc, MessageDoc
from app.nlp.intent import intent_classifier
from app.rag.assembler import AnswerAssembler, stream_answer
from app.cache.redis_cache import get_cached_answer, set_cached_answer

chat_rate_limit = "10000/minute" if os.getenv("PYTEST_CURRENT_TEST") or os.getenv("TESTING") else "30/minute"
limiter = get_limiter()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])

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


async def _mirror_turn_to_mongo(
    mongo_db,
    *,
    user_id: int,
    sql_conversation_id: int,
    title: str,
    mode: str,
    equipment: str | None,
    user_msg_sql_id: int,
    user_content: str,
    answer_msg_sql_id: int | None,
    answer: dict | None,
) -> None:
    """Mirror one completed turn (prompt + answer) into MongoDB (Day 3 B).

    Additive and best-effort: SQLite has already committed, so a failure here
    is logged and swallowed. Idempotent on retry — a message is inserted only
    if its SQLite id has not been mirrored yet.

    Takes plain values, never ORM instances: the SSE generator outlives the
    request's SQLAlchemy session, so touching a model there raises
    "Instance ... is not bound to a Session".
    """
    if mongo_db is None:
        return
    try:
        conv_repo = ConversationRepo(mongo_db)
        msg_repo = MessageRepo(mongo_db)

        conv = await conv_repo.find_by_id_and_user(sql_conversation_id, user_id)
        if conv is None:
            conv_id = await conv_repo.insert_one(
                user_id=user_id,
                title=title or user_content[:80],
                mode=mode,
                equipment=equipment,
                sql_id=sql_conversation_id,
            )
        else:
            conv_id = conv["_id"]
            await conv_repo.update_one(conv_id, user_id)

        if await msg_repo.find_by_sql_id(user_msg_sql_id) is None:
            await msg_repo.insert_one(
                conv_id, "user", user_content, sql_id=user_msg_sql_id
            )

        if answer_msg_sql_id is not None and answer is not None:
            if await msg_repo.find_by_sql_id(answer_msg_sql_id) is None:
                await msg_repo.insert_one(
                    conv_id,
                    "assistant",
                    answer.get("answer", ""),
                    intent=answer.get("intent"),
                    entities={
                        "equipment": answer.get("equipment"),
                        "test": answer.get("test"),
                    },
                    citations=answer.get("citations", []),
                    confidence=answer.get("confidence"),
                    sql_id=answer_msg_sql_id,
                )
    except Exception:
        logger.warning(
            "MongoDB mirror failed for conversation %s",
            sql_conversation_id,
            exc_info=True,
        )


@router.post("/stream")
@limiter.limit("30/minute")
async def chat_stream(
    request: Request,
    request_body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    conversation = _get_or_create_conversation(db, request_body, current_user.id)

    # Snapshot plain values before streaming starts: the event generator below
    # runs after the request's SQLAlchemy session has been closed, so it must
    # never touch an ORM instance (they come back detached and expired).
    user_id = current_user.id
    sql_conversation_id = conversation.id
    conversation_title = conversation.title or request_body.message[:80]
    conversation_mode = conversation_mode.value if conversation_mode else "qa"
    equipment = request_body.equipment

    user_msg = Message(
        conversation_id=sql_conversation_id, role="user", content=request_body.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    user_msg_sql_id = user_msg.id
    user_content = user_msg.content

    history = (
        db.query(Message)
        .filter(Message.conversation_id == sql_conversation_id)
        .order_by(Message.created_at)
        .all()
    )
    history_text = [f"{m.role}: {m.content}" for m in history[-8:]]

    understanding = intent_classifier.classify(request_body.message, history_text)
    if request_body.equipment and not understanding.equipment:
        understanding.equipment = request_body.equipment

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
                    conversation_id=sql_conversation_id,
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
                answer_msg_sql_id = assistant_msg.id

                # Persist the turn to MongoDB for the history view (Day 3 B).
                # The SQLite write above already succeeded, so this is additive.
                await _mirror_turn_to_mongo(
                    mongo_db,
                    user_id=user_id,
                    sql_conversation_id=sql_conversation_id,
                    title=conversation_title,
                    mode=conversation_mode,
                    equipment=equipment,
                    user_msg_sql_id=user_msg_sql_id,
                    user_content=user_content,
                    answer_msg_sql_id=answer_msg_sql_id,
                    answer=final,
                )
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': {'message': str(e)}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    conversation = _get_or_create_conversation(db, request, current_user.id)

    user_id = current_user.id
    sql_conversation_id = conversation.id
    conversation_title = conversation.title or request.message[:80]
    conversation_mode = conversation.mode.value if conversation.mode else "qa"
    equipment = request.equipment

    user_msg = Message(
        conversation_id=sql_conversation_id, role="user", content=request.message
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    user_msg_sql_id = user_msg.id
    user_content = user_msg.content

    history = (
        db.query(Message)
        .filter(Message.conversation_id == sql_conversation_id)
        .order_by(Message.created_at)
        .all()
    )
    history_text = [f"{m.role}: {m.content}" for m in history[-8:]]

    understanding = intent_classifier.classify(request.message, history_text)
    if request.equipment and not understanding.equipment:
        understanding.equipment = request.equipment

    # Check cache for repeated questions
    cache_key = f"{request.message}|{request.equipment or 'none'}"
    cached = await get_cached_answer(request.message, request.equipment)
    if cached:
        result = cached
        latency_ms = 0  # Cached response
    else:
        started = time.perf_counter()
        assembler = AnswerAssembler(db)
        result = assembler.assemble(understanding, history_text)
        latency_ms = int((time.perf_counter() - started) * 1000)
        # Cache the answer for 1 hour
        await set_cached_answer(request.message, request.equipment, result)

    assistant_msg = Message(
        conversation_id=sql_conversation_id,
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

    # Persist the turn to MongoDB for the history view (Day 3 B). SQLite stays
    # the source of truth; Mongo is best-effort.
    await _mirror_turn_to_mongo(
        mongo_db,
        user_id=user_id,
        sql_conversation_id=sql_conversation_id,
        title=conversation_title,
        mode=conversation_mode,
        equipment=equipment,
        user_msg_sql_id=user_msg_sql_id,
        user_content=user_content,
        answer_msg_sql_id=assistant_msg.id,
        answer=result,
    )

    return ChatResponse(
        **result,
        conversation_id=conversation.id,
    )


def _sql_conversation_summaries(db: Session, user_id: int) -> list[dict]:
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
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


async def _mongo_conversation_summaries(
    mongo_db, user_id: int
) -> list[dict] | None:
    """History list straight from MongoDB; ``None`` when Mongo is unavailable."""
    if mongo_db is None:
        return None
    try:
        conv_repo = ConversationRepo(mongo_db)
        msg_repo = MessageRepo(mongo_db)
        summaries: list[dict] = []
        for row in await conv_repo.find_many_by_user(user_id):
            doc = ConversationDoc.model_validate(row)
            summaries.append(
                {
                    "id": doc.public_id,
                    "title": doc.title or f"Conversation {doc.public_id}",
                    "mode": doc.mode,
                    "created_at": doc.created_at,
                    "message_count": await msg_repo.count_by_conversation(doc.id),
                }
            )
        return summaries
    except Exception:
        logger.warning("MongoDB history read failed", exc_info=True)
        return None


def _sort_timestamp(value) -> float:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.timestamp()
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0.0
    return 0.0


@router.get("/conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    """Conversation history, read from MongoDB (Day 3 C).

    Rows already mirrored into Mongo win; SQLite rows that never made it into
    Mongo (e.g. written while Mongo was down) are merged back in so history
    never looks emptier than it is.
    """
    mongo_rows = await _mongo_conversation_summaries(mongo_db, current_user.id)
    if mongo_rows is None:
        return _sql_conversation_summaries(db, current_user.id)

    mirrored = {row["id"] for row in mongo_rows if isinstance(row["id"], int)}
    merged = mongo_rows + [
        row
        for row in _sql_conversation_summaries(db, current_user.id)
        if row["id"] not in mirrored
    ]
    merged.sort(key=lambda row: _sort_timestamp(row.get("created_at")), reverse=True)
    return merged


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    mongo_db=Depends(get_mongo),
):
    if mongo_db is not None:
        try:
            conv = await ConversationRepo(mongo_db).find_by_id_and_user(
                conversation_id, current_user.id
            )
            if conv is not None:
                messages = await MessageRepo(mongo_db).find_many_by_conversation(
                    conv["_id"]
                )
                if messages:
                    conversation_doc = ConversationDoc.model_validate(conv)
                    message_docs = [MessageDoc.model_validate(m) for m in messages]
                    return {
                        "id": conversation_doc.public_id,
                        "title": conversation_doc.title,
                        "mode": conversation_doc.mode,
                        "created_at": conversation_doc.created_at,
                        "messages": [
                            {
                                "id": m.public_id,
                                "role": m.role,
                                "content": m.content,
                                "intent": m.intent,
                                "citations": m.citations,
                                "confidence": m.confidence,
                                "created_at": m.created_at,
                            }
                            for m in message_docs
                        ],
                    }
        except Exception:
            logger.warning(
                "MongoDB conversation read failed for %s", conversation_id,
                exc_info=True,
            )

    # SQLite fallback: conversations written before the mirror existed, or
    # while MongoDB was down.
    try:
        sql_id = int(conversation_id)
    except ValueError:
        raise HTTPException(404, "Conversation not found")

    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == sql_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(404, "Conversation not found")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == sql_id)
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
    mongo_deleted = False
    if mongo_db is not None:
        try:
            conv_repo = ConversationRepo(mongo_db)
            msg_repo = MessageRepo(mongo_db)
            # Owner-scoped lookup first: never delete messages of a
            # conversation this user does not own.
            conv = await conv_repo.find_by_id_and_user(
                conversation_id, current_user.id
            )
            if conv is not None:
                # Children first: resolving the messages needs the header's
                # ObjectId.
                await msg_repo.delete_many_by_conversation(conv["_id"])
                mongo_deleted = await conv_repo.delete_one(
                    conversation_id, current_user.id
                )
        except Exception:
            logger.warning(
                "MongoDB conversation delete failed for %s", conversation_id,
                exc_info=True,
            )

    try:
        sql_id = int(conversation_id)
    except ValueError:
        sql_id = None

    if sql_id is not None:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == sql_id, Conversation.user_id == current_user.id)
            .first()
        )
        if conversation:
            db.delete(conversation)
            db.commit()
            return {"ok": True}

    if mongo_deleted:
        return {"ok": True}
    raise HTTPException(404, "Conversation not found")
