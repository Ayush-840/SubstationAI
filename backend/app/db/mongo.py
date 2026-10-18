from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings

settings = get_settings()

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def get_mongo() -> AsyncIOMotorDatabase:
    """Return a connected MongoDB database instance (singleton per process)."""
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(settings.MONGO_URL)
        _db = _client[settings.MONGO_DB]
    return _db


async def close_mongo() -> None:
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
