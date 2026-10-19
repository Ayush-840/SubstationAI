"""In-memory stand-in for a Motor database.

The repositories are thin async wrappers over Motor, so the API and repository
tests run against this fake instead of a live MongoDB. It implements exactly
the operator subset the repositories use: equality filters, ``$set`` /
``$setOnInsert`` upserts, and insert/find/update/count/delete.
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, AsyncIterator

from bson import ObjectId


class _AsyncCursor:
    """Async iterator over a snapshot of matching documents."""

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


class FakeCollection:
    def __init__(self, name: str) -> None:
        self.name = name
        self.docs: dict[Any, dict[str, Any]] = {}

    @staticmethod
    def _matches(doc: dict[str, Any], flt: dict[str, Any]) -> bool:
        return all(doc.get(key) == value for key, value in flt.items())

    async def insert_one(self, doc: dict[str, Any]) -> SimpleNamespace:
        stored = copy.deepcopy(doc)
        stored.setdefault("_id", ObjectId())
        self.docs[stored["_id"]] = stored
        return SimpleNamespace(inserted_id=stored["_id"])

    async def find_one(
        self, flt: dict[str, Any], projection: dict[str, Any] | None = None, **_: Any
    ) -> dict[str, Any] | None:
        for doc in self.docs.values():
            if self._matches(doc, flt):
                return copy.deepcopy(doc)
        return None

    def find(self, flt: dict[str, Any], *args: Any, **kwargs: Any) -> _AsyncCursor:
        rows = [copy.deepcopy(d) for d in self.docs.values() if self._matches(d, flt)]
        return _AsyncCursor(rows)

    async def update_one(
        self,
        flt: dict[str, Any],
        update: dict[str, Any],
        upsert: bool = False,
        **_: Any,
    ) -> SimpleNamespace:
        target = next((d for d in self.docs.values() if self._matches(d, flt)), None)
        if target is None:
            if not upsert:
                return SimpleNamespace(matched_count=0, modified_count=0, upserted_id=None)
            new_doc = copy.deepcopy(flt)
            new_doc.pop("_id", None)
            new_doc.setdefault("_id", ObjectId())
            for key, value in update.get("$setOnInsert", {}).items():
                new_doc[key] = value
            for key, value in update.get("$set", {}).items():
                new_doc[key] = value
            new_doc.setdefault("_id", ObjectId())
            self.docs[new_doc["_id"]] = new_doc
            return SimpleNamespace(
                matched_count=0, modified_count=0, upserted_id=new_doc["_id"]
            )

        for key, value in update.get("$set", {}).items():
            target[key] = value
        return SimpleNamespace(matched_count=1, modified_count=1, upserted_id=None)

    async def count_documents(self, flt: dict[str, Any], **_: Any) -> int:
        return sum(1 for d in self.docs.values() if self._matches(d, flt))

    async def delete_one(self, flt: dict[str, Any], **_: Any) -> SimpleNamespace:
        for key, doc in list(self.docs.items()):
            if self._matches(doc, flt):
                del self.docs[key]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)

    async def delete_many(self, flt: dict[str, Any], **_: Any) -> SimpleNamespace:
        keys = [k for k, d in self.docs.items() if self._matches(d, flt)]
        for key in keys:
            del self.docs[key]
        return SimpleNamespace(deleted_count=len(keys))

    async def create_index(self, *args: Any, **kwargs: Any) -> str:
        return "ok"


class FakeMongoDB:
    """Duck-typed ``AsyncIOMotorDatabase``."""

    def __init__(self) -> None:
        self._collections: dict[str, FakeCollection] = {}

    def __getitem__(self, name: str) -> FakeCollection:
        return self._collections.setdefault(name, FakeCollection(name))

    def documents(self, name: str) -> list[dict[str, Any]]:
        """All documents currently in a collection (test assertions)."""
        return list(self[name].docs.values())

    def clear(self) -> None:
        self._collections.clear()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def iter_all(cursor: AsyncIterator[dict[str, Any]]) -> list[dict[str, Any]]:
    return [doc async for doc in cursor]
