from bson import ObjectId
from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongo import get_mongo


MESSAGE_ID_FIELD = "_id"  # MongoDB _id for messages; stored as ObjectId


class ConversationRepo:
    COLLECTION = "conversations"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._coll = db[self.COLLECTION]

    async def insert_one(
        self,
        user_id: int,
        title: str,
        mode: str,
        equipment: str | None = None,
    ) -> str:
        doc = {
            "user_id": user_id,
            "title": title,
            "mode": mode,
            "equipment": equipment,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await self._coll.insert_one(doc)
        return str(result.inserted_id)

    async def find_by_id_and_user(
        self, conversation_id: str, user_id: int
    ) -> dict[str, Any] | None:
        doc = await self._coll.find_one(
            {"_id": ObjectId(conversation_id), "user_id": user_id}
        )
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        return doc

    async def find_many_by_user(
        self, user_id: int, limit: int = 100, sort_desc: bool = True
    ) -> list[dict[str, Any]]:
        cursor = self._coll.find({"user_id": user_id})
        rows: list[dict[str, Any]] = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc.setdefault("user_id", user_id)
            rows.append(doc)
        rows.sort(
            key=lambda r: r.get("created_at") or datetime.min.replace(tzinfo=timezone.utc),
            reverse=sort_desc,
        )
        if limit:
            rows = rows[:limit]
        return rows

    async def delete_one(self, conversation_id: str, user_id: int) -> bool:
        result = await self._coll.delete_one(
            {"_id": ObjectId(conversation_id), "user_id": user_id}
        )
        return result.deleted_count > 0


class MessageRepo:
    COLLECTION = "messages"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._coll = db[self.COLLECTION]

    async def insert_one(
        self,
        conversation_id: str,
        role: str,
        content: str,
        intent: str | None = None,
        entities: dict[str, Any] | None = None,
        citations: list[dict[str, Any]] | None = None,
        confidence: float | None = None,
    ) -> str:
        doc = {
            "conversation_id": ObjectId(conversation_id),
            "role": role,
            "content": content,
            "intent": intent,
            "entities": entities,
            "citations": citations or [],
            "confidence": confidence,
            "created_at": datetime.now(timezone.utc),
        }
        result = await self._coll.insert_one(doc)
        return str(result.inserted_id)

    async def find_many_by_conversation(
        self, conversation_id: str, limit: int = 500
    ) -> list[dict[str, Any]]:
        cursor = self._coll.find(
            {"conversation_id": ObjectId(conversation_id)}
        )
        rows: list[dict[str, Any]] = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["conversation_id"] = str(doc["conversation_id"])
            rows.append(doc)
        rows.sort(
            key=lambda r: r.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
        )
        if limit:
            rows = rows[:limit]
        return rows

    async def delete_many_by_conversation(
        self, conversation_id: str
    ) -> int:
        result = await self._coll.delete_many(
            {"conversation_id": ObjectId(conversation_id)}
        )
        return result.deleted_count
