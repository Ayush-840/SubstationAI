"""Mongo repository unit tests using a mocked Motor database.

These run without a live MongoDB instance (the repository is a thin async
wrapper over Motor, so the contract is tested with an in-memory fake).
"""

from typing import Any, AsyncIterator
from bson import ObjectId
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.db.mongo_repos import ConversationRepo, MessageRepo


class _AsyncCursor:
    """Async iterator that yields documents one by one."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self._idx = 0

    def __aiter__(self) -> "_AsyncCursor":
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._idx >= len(self._rows):
            raise StopAsyncIteration
        row = self._rows[self._idx]
        self._idx += 1
        return row


def _row(id_override=None, **kwargs) -> dict[str, Any]:
    row = {"_id": ObjectId(), **kwargs}
    if id_override is not None:
        row["_id"] = id_override
    return row


def _make_fake_collection_with_find(
    rows: list[dict[str, Any]],
) -> MagicMock:
    """Fake Motor collection whose `.find()` returns an async cursor over `rows`.

    Motor's `find()` returns an async iterable cursor, so the fake returns a
    fresh _AsyncCursor for each call.
    """

    def fake_find(
        filter_doc: dict[str, Any], *args: Any, **kwargs: Any
    ) -> _AsyncCursor:
        return _AsyncCursor(rows)

    coll = MagicMock()
    coll.find = fake_find
    return coll


def _make_fake_collection_empty() -> MagicMock:
    """Fake Motor collection whose `.find()` yields nothing."""
    return _make_fake_collection_with_find([])


def _insert_one_async(return_id: ObjectId | None = None) -> Any:
    """AsyncMock whose await returns an InsertOneResult-like object."""
    result = MagicMock(inserted_id=return_id or ObjectId())
    return AsyncMock(return_value=result)


def _delete_one_async(deleted_count: int = 0) -> Any:
    return AsyncMock(return_value=MagicMock(deleted_count=deleted_count))


def _delete_many_async(deleted_count: int = 0) -> Any:
    return AsyncMock(return_value=MagicMock(deleted_count=deleted_count))


@pytest.fixture
def conversations_collection() -> MagicMock:
    return _make_fake_collection_with_find([])


@pytest.fixture
def messages_collection() -> MagicMock:
    return _make_fake_collection_with_find([])


@pytest.fixture
def mongo_db(conversations_collection: MagicMock, messages_collection: MagicMock) -> Any:
    db = MagicMock()
    db["conversations"] = conversations_collection
    db["messages"] = messages_collection
    return db


class TestConversationRepo:
    @pytest.mark.asyncio
    async def test_insert_one_returns_string_id(self, mongo_db):
        inserted_id = ObjectId()
        coll = mongo_db["conversations"]
        coll.insert_one = _insert_one_async(return_id=inserted_id)
        repo = ConversationRepo(mongo_db)
        conv_id = await repo.insert_one(
            user_id=1, title="SFRA on transformer", mode="qa"
        )
        assert isinstance(conv_id, str)
        assert conv_id == str(inserted_id)

    @pytest.mark.asyncio
    async def test_find_by_id_and_user_returns_doc(self, mongo_db):
        conv_id = ObjectId()
        coll = mongo_db["conversations"]
        coll.find_one = AsyncMock(
            return_value=_row(
                id_override=str(conv_id),
                user_id=1,
                title="History chat",
                mode="qa",
                created_at=None,
                updated_at=None,
            )
        )
        repo = ConversationRepo(mongo_db)
        found = await repo.find_by_id_and_user(str(conv_id), user_id=1)
        assert found is not None
        assert found["title"] == "History chat"
        assert found["_id"] == str(conv_id)

    @pytest.mark.asyncio
    async def test_find_by_id_and_user_returns_none_for_wrong_user(self, mongo_db):
        conv_id = ObjectId()
        coll = mongo_db["conversations"]
        coll.find_one = AsyncMock(return_value=None)
        repo = ConversationRepo(mongo_db)
        found = await repo.find_by_id_and_user(str(conv_id), user_id=1)
        assert found is None

    @pytest.mark.asyncio
    async def test_find_many_by_user_returns_only_own(self, mongo_db):
        my_id = ObjectId()
        other_id = ObjectId()
        coll = mongo_db["conversations"]
        coll.find = _make_fake_collection_with_find(
            [
                _row(
                    id_override=str(my_id),
                    user_id=1,
                    title="My chat",
                    mode="qa",
                    created_at=None,
                    updated_at=None,
                ),
            ]
        ).find
        repo = ConversationRepo(mongo_db)
        rows = await repo.find_many_by_user(user_id=1)
        assert len(rows) == 1
        assert rows[0]["_id"] == str(my_id)
        assert rows[0]["user_id"] == 1
        assert rows[0]["mode"] == "qa"

    @pytest.mark.asyncio
    async def test_delete_one_returns_false_for_missing(self, mongo_db):
        conv_id = ObjectId()
        coll = mongo_db["conversations"]
        coll.delete_one = _delete_one_async(deleted_count=0)
        repo = ConversationRepo(mongo_db)
        deleted = await repo.delete_one(str(conv_id), user_id=1)
        assert deleted is False


class TestMessageRepo:
    @pytest.mark.asyncio
    async def test_insert_one_stores_conversation_id_as_objectid(self, mongo_db):
        """Conversation id must be stored as ObjectId, not string."""
        conv_id = ObjectId()
        coll = mongo_db["messages"]
        inserted_id = ObjectId()
        captured_doc: dict[str, Any] | None = None

        async def fake_insert_one(doc: dict[str, Any]) -> Any:
            nonlocal captured_doc
            captured_doc = doc
            return MagicMock(inserted_id=inserted_id)

        coll.insert_one = fake_insert_one
        repo = MessageRepo(mongo_db)
        msg_id = await repo.insert_one(
            conversation_id=str(conv_id),
            role="assistant",
            content="IR > 1000",
        )
        assert msg_id == str(inserted_id)
        assert isinstance(captured_doc["conversation_id"], ObjectId)
        assert captured_doc["conversation_id"] == conv_id
        assert captured_doc["role"] == "assistant"
        assert captured_doc["content"] == "IR > 1000"

    @pytest.mark.asyncio
    async def test_insert_one_returns_string_id(self, mongo_db):
        inserted_id = ObjectId()
        coll = mongo_db["messages"]
        coll.insert_one = _insert_one_async(return_id=inserted_id)
        repo = MessageRepo(mongo_db)
        msg_id = await repo.insert_one(
            conversation_id=ObjectId().__str__(),
            role="assistant",
            content="IR should be > 1000 MΩ",
        )
        assert isinstance(msg_id, str)
        assert msg_id == str(inserted_id)

    @pytest.mark.asyncio
    async def test_find_many_by_conversation_returns_sorted_messages(self, mongo_db):
        conv_id = ObjectId()
        m1 = _row(id_override=ObjectId(), role="user", content="hi", created_at=None)
        m2 = _row(id_override=ObjectId(), role="assistant", content="hello", created_at=None)
        coll = mongo_db["messages"]
        coll.find = _make_fake_collection_with_find(
            [
                {
                    "_id": ObjectId(conv_id),
                    "conversation_id": ObjectId(conv_id),
                    **m1,
                },
                {
                    "_id": ObjectId(conv_id),
                    "conversation_id": ObjectId(conv_id),
                    **m2,
                },
            ]
        ).find
        repo = MessageRepo(mongo_db)
        rows = await repo.find_many_by_conversation(str(conv_id))
        assert len(rows) == 2
        assert all(r["conversation_id"] == str(conv_id) for r in rows)
        assert {r["role"] for r in rows} == {"user", "assistant"}
        assert all(isinstance(r["_id"], str) for r in rows)

    @pytest.mark.asyncio
    async def test_find_many_by_conversation_returns_empty_for_missing(self, mongo_db):
        coll = mongo_db["messages"]
        coll.find = _make_fake_collection_empty().find
        repo = MessageRepo(mongo_db)
        rows = await repo.find_many_by_conversation(ObjectId().__str__())
        assert rows == []

    @pytest.mark.asyncio
    async def test_delete_many_by_conversation_returns_count(self, mongo_db):
        conv_id = ObjectId()
        coll = mongo_db["messages"]
        coll.delete_many = _delete_many_async(deleted_count=2)
        repo = MessageRepo(mongo_db)
        count = await repo.delete_many_by_conversation(str(conv_id))
        assert count == 2

    @pytest.mark.asyncio
    async def test_insert_and_read_roundtrip(self, mongo_db):
        """Insert a message then read it back; citations/entities round-trip."""
        conv_id = ObjectId()
        inserted_id = ObjectId()
        coll = mongo_db["messages"]
        coll.insert_one = _insert_one_async(return_id=inserted_id)
        stored_rows: list[dict[str, Any]] = [
            {
                "_id": inserted_id,
                "conversation_id": ObjectId(conv_id),
                "role": "assistant",
                "content": "IR >= 1000 MΩ",
                "intent": "limits",
                "entities": {"equipment": "Power Transformer"},
                "citations": [{"document": "TR-01", "page": 12}],
                "confidence": 0.87,
                "created_at": None,
            }
        ]
        coll.find = _make_fake_collection_with_find(stored_rows).find
        repo = MessageRepo(mongo_db)

        msg_id = await repo.insert_one(
            conversation_id=str(conv_id),
            role="assistant",
            content="IR >= 1000 MΩ",
            intent="limits",
            entities={"equipment": "Power Transformer"},
            citations=[{"document": "TR-01", "page": 12}],
            confidence=0.87,
        )
        assert msg_id == str(inserted_id)

        rows = await repo.find_many_by_conversation(str(conv_id))
        assert len(rows) == 1
        row = rows[0]
        assert row["content"] == "IR >= 1000 MΩ"
        assert row["entities"] == {"equipment": "Power Transformer"}
        assert row["citations"] == [{"document": "TR-01", "page": 12}]
        assert row["confidence"] == 0.87


# --- Day 3 additions: SQLite id bridge, updates and Pydantic documents -------

from bson.errors import InvalidId  # noqa: E402

from app.db.mongo_repos import MessageNotFound, to_object_id  # noqa: E402
from app.schemas import ConversationDoc, MessageDoc  # noqa: E402
from tests.mongo_fakes import FakeMongoDB  # noqa: E402


class TestObjectIdBoundary:
    def test_to_object_id_accepts_object_id_and_hex(self):
        oid = ObjectId()
        assert to_object_id(oid) is oid
        assert to_object_id(str(oid)) == oid

    def test_to_object_id_rejects_garbage(self):
        with pytest.raises(InvalidId):
            to_object_id("not-an-object-id")

    def test_plain_sql_id_is_not_a_valid_object_id(self):
        # Endpoints resolve SQLite ids through the repo's sql_id bridge;
        # they must never reach to_object_id directly.
        with pytest.raises(InvalidId):
            to_object_id(12)


class TestConversationSqlBridge:
    @pytest.mark.asyncio
    async def test_insert_stores_sql_id_and_reads_back(self):
        db = FakeMongoDB()
        repo = ConversationRepo(db)
        conv_id = await repo.insert_one(
            user_id=7, title="Bridge", mode="qa", sql_id=42
        )
        stored = db.documents("conversations")[0]
        assert stored["sql_id"] == 42
        assert stored["user_id"] == 7

        by_sql = await repo.find_by_id_and_user(42, user_id=7)
        assert by_sql is not None and by_sql["_id"] == conv_id
        assert await repo.find_by_id_and_user(43, user_id=7) is None
        assert await repo.find_by_id_and_user(42, user_id=8) is None

    @pytest.mark.asyncio
    async def test_update_one_patches_owner_scoped_fields(self):
        db = FakeMongoDB()
        repo = ConversationRepo(db)
        conv_id = await repo.insert_one(
            user_id=7, title="Old", mode="qa", sql_id=5
        )

        assert await repo.update_one(conv_id, user_id=7, title="New") is True
        assert (await repo.find_by_id_and_user(conv_id, 7))["title"] == "New"
        assert (await repo.find_by_id_and_user(conv_id, 7))["updated_at"] is not None

        # A different owner cannot patch the row.
        assert await repo.update_one(conv_id, user_id=8, title="Hacked") is False
        assert (await repo.find_by_id_and_user(conv_id, 7))["title"] == "New"

    @pytest.mark.asyncio
    async def test_delete_one_by_sql_id(self):
        db = FakeMongoDB()
        repo = ConversationRepo(db)
        await repo.insert_one(user_id=1, title="Gone", mode="qa", sql_id=9)
        assert await repo.delete_one(9, user_id=1) is True
        assert await repo.find_by_id_and_user(9, user_id=1) is None


class TestMessageSqlBridge:
    @pytest.mark.asyncio
    async def test_resolve_conversation_by_sql_id(self):
        db = FakeMongoDB()
        conv_repo = ConversationRepo(db)
        msg_repo = MessageRepo(db)
        conv_oid = await conv_repo.insert_one(
            user_id=1, title="T", mode="qa", sql_id=11
        )

        msg_id = await msg_repo.insert_one(11, "user", "hello", sql_id=101)
        stored = db.documents("messages")[0]
        assert stored["conversation_id"] == ObjectId(conv_oid)
        assert stored["sql_id"] == 101

        rows = await msg_repo.find_many_by_conversation(11)
        assert len(rows) == 1 and rows[0]["_id"] == msg_id
        assert await msg_repo.count_by_conversation(11) == 1

        found = await msg_repo.find_by_sql_id(101)
        assert found is not None and found["content"] == "hello"

    @pytest.mark.asyncio
    async def test_unknown_sql_conversation_is_not_mirrored(self):
        db = FakeMongoDB()
        msg_repo = MessageRepo(db)
        with pytest.raises(MessageNotFound):
            await msg_repo.insert_one(999, "user", "hi")
        assert await msg_repo.find_many_by_conversation(999) == []
        assert await msg_repo.count_by_conversation(999) == 0


class TestPydanticDocuments:
    @pytest.mark.asyncio
    async def test_conversation_doc_validates_from_motor_doc(self):
        db = FakeMongoDB()
        conv_id = await ConversationRepo(db).insert_one(
            user_id=3, title="Doc", mode="procedure", sql_id=21
        )
        doc = ConversationDoc.model_validate(db.documents("conversations")[0])
        assert doc.id == conv_id
        assert doc.public_id == 21
        dumped = doc.model_dump(mode="json")
        assert dumped["id"] == conv_id and "_id" not in dumped
        assert dumped["mode"] == "procedure"

    @pytest.mark.asyncio
    async def test_message_doc_stringifies_object_ids(self):
        db = FakeMongoDB()
        await ConversationRepo(db).insert_one(
            user_id=3, title="Doc", mode="qa", sql_id=21
        )
        await MessageRepo(db).insert_one(21, "assistant", "answer", sql_id=22)
        doc = MessageDoc.model_validate(db.documents("messages")[0])
        assert isinstance(doc.conversation_id, str)
        assert doc.public_id == 22
        assert doc.model_dump(mode="json")["conversation_id"] == doc.conversation_id


# --- Day 4 additions: feedback and fault_logs collections ---------------------

from app.db.mongo_repos import FaultLogRepo, FeedbackRepo  # noqa: E402
from app.schemas import FaultLogDoc, FeedbackDoc  # noqa: E402


class TestFeedbackRepo:
    @pytest.mark.asyncio
    async def test_upsert_resolves_sql_message_id_to_objectid(self):
        """The vote stores the message's ObjectId, not the SQLite id."""
        db = FakeMongoDB()
        await ConversationRepo(db).insert_one(
            user_id=1, title="T", mode="qa", sql_id=11
        )
        await MessageRepo(db).insert_one(11, "assistant", "answer", sql_id=101)

        stored = await FeedbackRepo(db).upsert_one(
            101, user_id=1, rating=1, comment="clear"
        )
        message_oid = db.documents("messages")[0]["_id"]
        raw = db.documents("feedback")[0]
        assert raw["message_id"] == message_oid  # BSON type matches messages._id
        assert stored["message_id"] == str(message_oid)
        assert stored["rating"] == 1 and stored["comment"] == "clear"
        assert stored["created_at"] is not None

    @pytest.mark.asyncio
    async def test_upsert_replaces_the_existing_vote(self):
        db = FakeMongoDB()
        await ConversationRepo(db).insert_one(
            user_id=1, title="T", mode="qa", sql_id=11
        )
        await MessageRepo(db).insert_one(11, "assistant", "answer", sql_id=101)
        repo = FeedbackRepo(db)

        first = await repo.upsert_one(101, user_id=1, rating=1)
        second = await repo.upsert_one(101, user_id=1, rating=-1, comment="wrong")

        assert len(db.documents("feedback")) == 1
        assert second["rating"] == -1 and second["comment"] == "wrong"
        assert second["created_at"] == first["created_at"]  # untouched by re-vote
        found = await repo.find_one(101, user_id=1)
        assert found is not None and found["rating"] == -1

    @pytest.mark.asyncio
    async def test_upsert_rejects_unknown_or_unmirrored_message(self):
        db = FakeMongoDB()
        repo = FeedbackRepo(db)
        with pytest.raises(MessageNotFound):
            await repo.upsert_one(999, user_id=1, rating=1)
        with pytest.raises(InvalidId):
            await repo.upsert_one("not-an-id", user_id=1, rating=1)
        assert db.documents("feedback") == []
        assert await repo.find_one(999, user_id=1) is None
        assert await repo.find_many_by_message(999) == []

    @pytest.mark.asyncio
    async def test_find_many_by_message_returns_owner_votes_only(self):
        """Day 7 B: only the conversation owner can vote on a message, so a
        message aggregates exactly one vote — theirs."""
        db = FakeMongoDB()
        await ConversationRepo(db).insert_one(
            user_id=1, title="T", mode="qa", sql_id=11
        )
        await MessageRepo(db).insert_one(11, "assistant", "answer", sql_id=101)
        repo = FeedbackRepo(db)

        await repo.upsert_one(101, user_id=1, rating=1)
        with pytest.raises(MessageNotFound):
            await repo.upsert_one(101, user_id=2, rating=-1)

        rows = await repo.find_many_by_message(101)
        assert {r["user_id"] for r in rows} == {1}
        assert len(db.documents("feedback")) == 1


class TestFaultLogRepo:
    @pytest.mark.asyncio
    async def test_insert_and_list_newest_first(self):
        db = FakeMongoDB()
        repo = FaultLogRepo(db)
        first = await repo.insert_one(
            user_id=1,
            equipment_class="Power Transformer",
            symptoms=["oil leak"],
            readings={"moisture_ppm": 40},
            diagnosis="Gasket wear",
            resolution="Inspect gasket",
        )
        await repo.insert_one(
            user_id=1,
            equipment_class="Circuit Breaker",
            symptoms=[],
            readings={},
            diagnosis=None,
            resolution=None,
        )
        assert isinstance(first, str)

        rows = await repo.find_many_by_user(1)
        assert [r["equipment_class"] for r in rows] == [
            "Circuit Breaker",
            "Power Transformer",
        ]
        assert rows[1]["symptoms"] == ["oil leak"]
        assert rows[1]["readings"] == {"moisture_ppm": 40}

    @pytest.mark.asyncio
    async def test_reads_and_deletes_are_owner_scoped(self):
        db = FakeMongoDB()
        repo = FaultLogRepo(db)
        log_id = await repo.insert_one(
            user_id=1,
            equipment_class="Switchgear",
            symptoms=[],
            readings={},
            diagnosis="A",
            resolution="B",
        )

        assert await repo.find_by_id_and_user(log_id, user_id=1) is not None
        assert await repo.find_by_id_and_user(log_id, user_id=2) is None
        assert await repo.find_many_by_user(2) == []
        assert await repo.delete_one(log_id, user_id=2) is False
        assert await repo.delete_one(log_id, user_id=1) is True
        assert await repo.find_by_id_and_user(log_id, user_id=1) is None


class TestDayFourDocuments:
    def test_feedback_doc_stringifies_message_id(self):
        oid = ObjectId()
        doc = FeedbackDoc.model_validate(
            {
                "_id": ObjectId(),
                "message_id": oid,
                "user_id": 4,
                "rating": -1,
                "comment": None,
            }
        )
        assert doc.message_id == str(oid)
        assert doc.model_dump(mode="json")["id"]

    def test_fault_log_doc_accepts_full_shape(self):
        doc = FaultLogDoc.model_validate(
            {
                "_id": ObjectId(),
                "user_id": 2,
                "equipment_class": "Power Transformer",
                "symptoms": ["bushing crack"],
                "readings": {"tan_delta": 0.9},
                "diagnosis": "Contaminated bushing",
                "resolution": "Wash and retest",
            }
        )
        dumped = doc.model_dump(mode="json")
        assert dumped["symptoms"] == ["bushing crack"]
        assert dumped["readings"] == {"tan_delta": 0.9}
        assert dumped["id"]


# --- Day 5 B: repository regression coverage ---------------------------------

import asyncio  # noqa: E402


class TestRepositoryRegressions:
    @pytest.mark.asyncio
    async def test_upsert_rejects_unmirrored_objectid_message(self):
        """A raw ObjectId is verified against `messages`, never trusted.

        Regression: an id that already looks like an ObjectId used to skip
        the existence check, letting a vote reference a message that was
        never mirrored (dangling $lookup row).
        """
        db = FakeMongoDB()
        repo = FeedbackRepo(db)
        with pytest.raises(MessageNotFound):
            await repo.upsert_one(ObjectId(), user_id=1, rating=1)
        assert db.documents("feedback") == []

    @pytest.mark.asyncio
    async def test_feedback_votes_are_isolated_per_user(self):
        """Day 7 B: each user votes inside their own conversations only."""
        db = FakeMongoDB()
        await ConversationRepo(db).insert_one(
            user_id=1, title="T", mode="qa", sql_id=11
        )
        await ConversationRepo(db).insert_one(
            user_id=2, title="U", mode="qa", sql_id=12
        )
        await MessageRepo(db).insert_one(11, "assistant", "answer", sql_id=101)
        await MessageRepo(db).insert_one(12, "assistant", "other", sql_id=102)
        repo = FeedbackRepo(db)
        await repo.upsert_one(101, user_id=1, rating=1)
        await repo.upsert_one(102, user_id=2, rating=-1)
        with pytest.raises(MessageNotFound):
            await repo.upsert_one(101, user_id=2, rating=-1)  # foreign message

        mine = await repo.find_one(101, user_id=1)
        theirs = await repo.find_one(102, user_id=2)
        assert mine["rating"] == 1 and theirs["rating"] == -1
        assert await repo.find_one(101, user_id=99) is None
        assert len(db.documents("feedback")) == 2
        assert len(await repo.find_many_by_message(101)) == 1

    @pytest.mark.asyncio
    async def test_find_by_sql_id_returns_none_when_absent(self):
        db = FakeMongoDB()
        await ConversationRepo(db).insert_one(
            user_id=1, title="T", mode="qa", sql_id=1
        )
        repo = MessageRepo(db)
        assert await repo.find_by_sql_id(77) is None
        await repo.insert_one(1, "user", "hi", sql_id=77)
        found = await repo.find_by_sql_id(77)
        assert found is not None and found["content"] == "hi"

    @pytest.mark.asyncio
    async def test_conversation_list_sorts_desc_and_limits(self):
        db = FakeMongoDB()
        repo = ConversationRepo(db)
        for i in range(3):
            await asyncio.sleep(0.001)  # deterministic created_at ordering
            await repo.insert_one(user_id=1, title=f"T{i}", mode="qa", sql_id=100 + i)
        await repo.insert_one(user_id=2, title="Other", mode="qa", sql_id=999)

        rows = await repo.find_many_by_user(1, limit=2, sort_desc=True)
        assert [r["title"] for r in rows] == ["T2", "T1"]
        rows = await repo.find_many_by_user(1, limit=0, sort_desc=False)
        assert [r["title"] for r in rows] == ["T0", "T1", "T2"]
        assert [r["title"] for r in await repo.find_many_by_user(2, limit=0)] == [
            "Other"
        ]

    @pytest.mark.asyncio
    async def test_fault_log_list_sorts_desc_and_limits(self):
        db = FakeMongoDB()
        repo = FaultLogRepo(db)
        for i in range(3):
            await asyncio.sleep(0.001)
            await repo.insert_one(
                user_id=1,
                equipment_class=f"E{i}",
                symptoms=[],
                readings={},
                diagnosis=None,
                resolution=None,
            )
        rows = await repo.find_many_by_user(1, limit=2, sort_desc=True)
        assert [r["equipment_class"] for r in rows] == ["E2", "E1"]
        rows = await repo.find_many_by_user(1, limit=0, sort_desc=False)
        assert [r["equipment_class"] for r in rows] == ["E0", "E1", "E2"]
