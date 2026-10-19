"""Async MongoDB connection (Motor).

MongoDB is a secondary store: SQLite stays the source of truth, so an
unavailable MongoDB must never take the API down. `get_mongo` therefore probes
the server once with a short timeout and, when the probe fails, backs off for
`RETRY_AFTER_SECONDS` instead of charging every request a server-selection
timeout.
"""

import logging
import time

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Fail fast: the driver default (30 s) would stall every Mongo-backed request
# while the container is still starting.
SERVER_SELECTION_TIMEOUT_MS = 1500

# How long to trust a failed probe before trying MongoDB again.
RETRY_AFTER_SECONDS = 30.0

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None
_retry_after: float = 0.0


async def get_mongo() -> AsyncIOMotorDatabase | None:
    """Return the app database, or ``None`` while MongoDB is unreachable."""
    global _client, _db, _retry_after

    if _db is not None:
        return _db

    now = time.monotonic()
    if now < _retry_after:
        return None

    try:
        client = AsyncIOMotorClient(
            settings.MONGO_URL,
            serverSelectionTimeoutMS=SERVER_SELECTION_TIMEOUT_MS,
            connectTimeoutMS=SERVER_SELECTION_TIMEOUT_MS,
        )
        await client.admin.command("ping")
    except Exception as exc:  # ServerSelectionTimeoutError, DNS failure, ...
        logger.info(
            "MongoDB unavailable (%s); retrying in %.0fs",
            type(exc).__name__,
            RETRY_AFTER_SECONDS,
        )
        _retry_after = now + RETRY_AFTER_SECONDS
        return None

    _client = client
    _db = client[settings.MONGO_DB]
    logger.info("Connected to MongoDB %s (%s)", settings.MONGO_URL, settings.MONGO_DB)
    return _db


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create the indexes the history, feedback and fault-log reads rely on."""
    try:
        await db.conversations.create_index("sql_id")
        await db.conversations.create_index([("user_id", 1), ("created_at", -1)])
        await db.messages.create_index("sql_id")
        await db.messages.create_index("conversation_id")
        await db.feedback.create_index(
            [("message_id", 1), ("user_id", 1)], unique=True
        )
        await db.fault_logs.create_index([("user_id", 1), ("logged_at", -1)])
    except Exception as exc:
        logger.warning("Could not create MongoDB indexes: %s", exc)


async def close_mongo() -> None:
    global _client, _db, _retry_after
    if _client:
        _client.close()
    _client = None
    _db = None
    _retry_after = 0.0
