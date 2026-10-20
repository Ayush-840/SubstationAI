"""MongoDB repositories for the conversation history collections (Day 3)
and the feedback / fault-log collections (Day 4).

Shape of the documents (see TRD §3.1):

* ``conversations`` — ``{_id, sql_id, user_id, title, mode, equipment,
  created_at, updated_at}`` — header only, so the history list stays a cheap
  paged read.
* ``messages`` — ``{_id, conversation_id, sql_id, role, content, intent,
  entities, citations[], confidence, created_at}`` — citations are embedded
  because they are always read with the message and never queried alone.
* ``feedback`` — ``{_id, message_id, user_id, rating, comment, created_at}``
  — ``message_id`` is the ObjectId of ``messages._id`` so a ``$lookup`` join
  type-matches.
* ``fault_logs`` — ``{_id, user_id, equipment_class, symptoms[],
  readings{}, diagnosis, resolution, logged_at}`` — fault diagnoses were
  never mirrored into SQLite, so this collection *is* the system of record.

Two conventions keep the mirror safe:

* every mirrored document also carries ``sql_id``, the SQLite primary key, so
  the API can keep returning the integer ids it returned before MongoDB
  existed (the eval harness and the frontend contract do not change);
* every id that crosses the repository boundary is converted to a BSON
  ``ObjectId`` **here**, never in an endpoint, so a later ``$lookup`` from
  ``feedback.message_id`` to ``messages._id`` can never silently mismatch on
  BSON type.
"""

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase


class MessageNotFound(LookupError):
    """Raised when a message id cannot be resolved to a mirrored document."""


def to_object_id(value: Any) -> ObjectId:
    """Convert a path/body id into an ``ObjectId`` at the repository boundary.

    Accepts an ``ObjectId``, a 24-char hex string, or anything that
    stringifies to one. Raises ``InvalidId`` otherwise so a bad id fails
    loudly instead of being written as a plain string.
    """
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except (InvalidId, TypeError) as exc:
        raise InvalidId(f"{value!r} is not a valid ObjectId") from exc


def _looks_like_object_id(value: Any) -> bool:
    try:
        to_object_id(value)
        return True
    except InvalidId:
        return False


def _is_sql_ref(value: Any) -> bool:
    """True for an id that still points at the SQLite primary key."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return (
        isinstance(value, str)
        and value.isdigit()
        and not _looks_like_object_id(value)
    )


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime:
    """Normalize naive (SQLite) and aware (MongoDB) timestamps for sorting."""
    if value is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class ConversationRepo:
    """CRUD over the ``conversations`` collection."""

    COLLECTION = "conversations"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._coll = db[self.COLLECTION]

    @staticmethod
    def _filter(conversation_id: Any, user_id: int | None = None) -> dict[str, Any]:
        flt: dict[str, Any] = {}
        if user_id is not None:
            flt["user_id"] = user_id
        if _is_sql_ref(conversation_id):
            flt["sql_id"] = int(conversation_id)
        else:
            flt["_id"] = to_object_id(conversation_id)
        return flt

    async def insert_one(
        self,
        user_id: int,
        title: str,
        mode: str,
        equipment: str | None = None,
        sql_id: int | None = None,
    ) -> str:
        doc: dict[str, Any] = {
            "sql_id": sql_id,
            "user_id": user_id,
            "title": title,
            "mode": mode,
            "equipment": equipment,
            "created_at": _utcnow(),
            "updated_at": _utcnow(),
        }
        result = await self._coll.insert_one(doc)
        return str(result.inserted_id)

    async def find_by_id_and_user(
        self, conversation_id: Any, user_id: int
    ) -> dict[str, Any] | None:
        """Look up one conversation by ObjectId **or** by its SQLite id."""
        doc = await self._coll.find_one(self._filter(conversation_id, user_id))
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
            rows.append(doc)
        rows.sort(key=lambda r: _as_utc(r.get("created_at")), reverse=sort_desc)
        if limit:
            rows = rows[:limit]
        return rows

    async def update_one(
        self, conversation_id: Any, user_id: int, **fields: Any
    ) -> bool:
        """Patch an existing conversation (owner-scoped).

        Called with no extra fields after each mirrored turn to bump
        ``updated_at``.
        """
        fields = {k: v for k, v in fields.items() if v is not None}
        fields["updated_at"] = _utcnow()
        result = await self._coll.update_one(
            self._filter(conversation_id, user_id), {"$set": fields}
        )
        return result.matched_count > 0

    async def delete_one(self, conversation_id: Any, user_id: int) -> bool:
        result = await self._coll.delete_one(self._filter(conversation_id, user_id))
        return result.deleted_count > 0


class MessageRepo:
    """CRUD over the ``messages`` collection."""

    COLLECTION = "messages"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._coll = db[self.COLLECTION]

    async def _conversation_object_id(self, conversation_id: Any) -> ObjectId | None:
        """Resolve a conversation reference (SQLite id or ObjectId) to its BSON id."""
        if _is_sql_ref(conversation_id):
            doc = await self._db[ConversationRepo.COLLECTION].find_one(
                {"sql_id": int(conversation_id)}
            )
            if doc is None:
                return None
            return to_object_id(doc["_id"])
        return to_object_id(conversation_id)

    async def insert_one(
        self,
        conversation_id: Any,
        role: str,
        content: str,
        intent: str | None = None,
        entities: dict[str, Any] | None = None,
        citations: list[dict[str, Any]] | None = None,
        confidence: float | None = None,
        sql_id: int | None = None,
    ) -> str:
        conv_oid = await self._conversation_object_id(conversation_id)
        if conv_oid is None:
            raise MessageNotFound(f"conversation {conversation_id!r} is not mirrored")
        doc: dict[str, Any] = {
            "conversation_id": conv_oid,
            "sql_id": sql_id,
            "role": role,
            "content": content,
            "intent": intent,
            "entities": entities,
            "citations": citations or [],
            "confidence": confidence,
            "created_at": _utcnow(),
        }
        result = await self._coll.insert_one(doc)
        return str(result.inserted_id)

    async def find_by_sql_id(self, sql_id: int) -> dict[str, Any] | None:
        """Find a mirrored message by its SQLite id (used to resolve feedback)."""
        doc = await self._coll.find_one({"sql_id": sql_id})
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        doc["conversation_id"] = str(doc["conversation_id"])
        return doc

    async def find_many_by_conversation(
        self, conversation_id: Any, limit: int = 500
    ) -> list[dict[str, Any]]:
        conv_oid = await self._conversation_object_id(conversation_id)
        if conv_oid is None:
            return []
        cursor = self._coll.find({"conversation_id": conv_oid})
        rows: list[dict[str, Any]] = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["conversation_id"] = str(doc["conversation_id"])
            rows.append(doc)
        rows.sort(key=lambda r: _as_utc(r.get("created_at")))
        if limit:
            rows = rows[:limit]
        return rows

    async def count_by_conversation(self, conversation_id: Any) -> int:
        conv_oid = await self._conversation_object_id(conversation_id)
        if conv_oid is None:
            return 0
        return await self._coll.count_documents({"conversation_id": conv_oid})

    async def delete_many_by_conversation(self, conversation_id: Any) -> int:
        conv_oid = await self._conversation_object_id(conversation_id)
        if conv_oid is None:
            return 0
        result = await self._coll.delete_many({"conversation_id": conv_oid})
        return result.deleted_count


class FeedbackRepo:
    """Upsert-style CRUD over the ``feedback`` collection (Day 4).

    One vote per (message, user): re-rating replaces the previous document
    instead of adding a row.
    """

    COLLECTION = "feedback"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._coll = db[self.COLLECTION]

    async def _message_object_id(self, message_id: Any) -> ObjectId | None:
        """Resolve a message id to an existing mirrored ``messages._id``.

        The API keeps handing out SQLite message ids, so an int (or digit
        string) is resolved through ``sql_id``; anything else is treated as an
        ObjectId. Both shapes are verified against the ``messages`` collection
        so a vote can never land on a dangling reference. Returns ``None``
        when there is no mirrored document (Mongo behind, or the id is
        unknown) and raises ``InvalidId`` for values that are neither.
        """
        if _is_sql_ref(message_id):
            flt: dict[str, Any] = {"sql_id": int(message_id)}
        else:
            flt: dict[str, Any] = {"_id": to_object_id(message_id)}
        doc = await self._db[MessageRepo.COLLECTION].find_one(flt)
        if doc is None:
            return None
        return to_object_id(doc["_id"])

    @staticmethod
    def _serialise(doc: dict[str, Any]) -> dict[str, Any]:
        out = dict(doc)
        out["_id"] = str(out["_id"])
        if out.get("message_id") is not None:
            out["message_id"] = str(out["message_id"])
        return out

    async def upsert_one(
        self,
        message_id: Any,
        user_id: int,
        rating: int,
        comment: str | None = None,
    ) -> dict[str, Any]:
        """Store the (message, user) vote, replacing any earlier one.

        Raises ``MessageNotFound`` when the message has no mirrored document,
        so a vote can never land on a dangling ``message_id``.
        """
        msg_oid = await self._message_object_id(message_id)
        if msg_oid is None:
            raise MessageNotFound(
                f"message {message_id!r} is not mirrored in MongoDB"
            )
        now = _utcnow()
        await self._coll.update_one(
            {"message_id": msg_oid, "user_id": user_id},
            {
                "$set": {
                    "message_id": msg_oid,
                    "user_id": user_id,
                    "rating": rating,
                    "comment": comment,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        stored = await self._coll.find_one(
            {"message_id": msg_oid, "user_id": user_id}
        )
        return self._serialise(stored)

    async def find_one(
        self, message_id: Any, user_id: int
    ) -> dict[str, Any] | None:
        msg_oid = await self._message_object_id(message_id)
        if msg_oid is None:
            return None
        doc = await self._coll.find_one(
            {"message_id": msg_oid, "user_id": user_id}
        )
        return self._serialise(doc) if doc else None

    async def find_many_by_message(
        self, message_id: Any
    ) -> list[dict[str, Any]]:
        msg_oid = await self._message_object_id(message_id)
        if msg_oid is None:
            return []
        rows: list[dict[str, Any]] = []
        async for doc in self._coll.find({"message_id": msg_oid}):
            rows.append(self._serialise(doc))
        rows.sort(key=lambda r: _as_utc(r.get("created_at")))
        return rows


class FaultLogRepo:
    """CRUD over the ``fault_logs`` collection (Day 4).

    Unlike the chat mirror there is no SQLite counterpart: diagnoses only
    ever land here, so reads and deletes are owner-scoped like everything
    else that carries ``user_id``.
    """

    COLLECTION = "fault_logs"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._coll = db[self.COLLECTION]

    async def insert_one(
        self,
        user_id: int,
        equipment_class: str,
        symptoms: list[str],
        readings: dict[str, Any],
        diagnosis: str | None,
        resolution: str | None,
    ) -> str:
        doc: dict[str, Any] = {
            "user_id": user_id,
            "equipment_class": equipment_class,
            "symptoms": list(symptoms or []),
            "readings": dict(readings or {}),
            "diagnosis": diagnosis,
            "resolution": resolution,
            "logged_at": _utcnow(),
        }
        result = await self._coll.insert_one(doc)
        return str(result.inserted_id)

    async def find_many_by_user(
        self, user_id: int, limit: int = 50, sort_desc: bool = True
    ) -> list[dict[str, Any]]:
        cursor = self._coll.find({"user_id": user_id})
        rows: list[dict[str, Any]] = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            rows.append(doc)
        rows.sort(key=lambda r: _as_utc(r.get("logged_at")), reverse=sort_desc)
        if limit:
            rows = rows[:limit]
        return rows

    async def find_by_id_and_user(
        self, log_id: Any, user_id: int
    ) -> dict[str, Any] | None:
        doc = await self._coll.find_one(
            {"_id": to_object_id(log_id), "user_id": user_id}
        )
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        return doc

    async def delete_one(self, log_id: Any, user_id: int) -> bool:
        result = await self._coll.delete_one(
            {"_id": to_object_id(log_id), "user_id": user_id}
        )
        return result.deleted_count == 1
