from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
import time

from app.db.session import get_db
from app.db.models import User, Conversation, Message, ConversationMode
from app.core.security import get_current_user
from app.schemas import ChatRequest, ChatResponse
from app.nlp.intent import intent_classifier
from app.rag.assembler import AnswerAssembler, stream_answer

router = APIRouter(prefix="/api/chat", tags=["chat"])

MODE_MAP = {
    "qa": ConversationMode.QA,
    "procedure": ConversationMode.PROCEDURE,
    "diagnosis": ConversationMode.DIAGNOSIS,
    "learn": ConversationMode.LEARN,
}


def _get_or_create_conversation(db: Session, request: ChatRequest, user_id: int) -> Conversation:
    if request.conversation_id:
        conversation = db.query(Conversation).filter(
            Conversation.id == request.conversation_id,
            Conversation.user_id == user_id,
        ).first()
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
async def chat_stream(request: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _get_or_create_conversation(db, request, current_user.id)

    user_msg = Message(conversation_id=conversation.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()

    history = db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at).all()
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
                    entities_json={"equipment": final.get("equipment"), "test": final.get("test")},
                    citations_json=final.get("citations", []),
                    confidence=final.get("confidence"),
                    latency_ms=latency_ms,
                )
                db.add(assistant_msg)
                db.commit()
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'data': {'message': str(e)}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("", response_model=ChatResponse)
def chat(request: ChatRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _get_or_create_conversation(db, request, current_user.id)

    user_msg = Message(conversation_id=conversation.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()

    history = db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at).all()
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
        entities_json={"equipment": result.get("equipment"), "test": result.get("test")},
        citations_json=result["citations"],
        confidence=result["confidence"],
        latency_ms=latency_ms,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)
    result["message_id"] = assistant_msg.id

    return ChatResponse(
        **result,
        conversation_id=conversation.id,
    )


@router.get("/conversations")
def get_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.created_at.desc()).all()

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
def get_conversation(conversation_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conversation:
        raise HTTPException(404, "Conversation not found")

    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()

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
def delete_conversation(conversation_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conversation:
        raise HTTPException(404, "Conversation not found")

    db.delete(conversation)
    db.commit()
    return {"ok": True}
