"""Redis cache helper for catalog reads and repeated-answer lookups (Day 9).

Keyed by normalized query + equipment class for chat answers.
Catalog reads cached by equipment class + filters.
"""

import json
import hashlib
from typing import Any, Optional
from functools import lru_cache

import redis.asyncio as redis
from redis.asyncio import Redis

from app.core.config import get_settings


@lru_cache()
def get_redis() -> Redis:
    """Get Redis client (singleton)."""
    settings = get_settings()
    return redis.from_url(
        settings.REDIS_URL or "redis://localhost:6379/0",
        encoding="utf-8",
        decode_responses=True,
    )


async def close_redis() -> None:
    """Close Redis connection pool."""
    r = get_redis()
    await r.close()


# ----- Cache key builders -----

def _normalize_query(q: str) -> str:
    """Lowercase, strip, collapse whitespace."""
    return " ".join(q.lower().split())


def _hash_key(*parts: str) -> str:
    """Stable short hash for Redis key."""
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]


def cache_key_catalog(equipment: Optional[str], page: int, page_size: int, sort: Optional[str], q: Optional[str]) -> str:
    parts = [
        "catalog",
        equipment or "all",
        str(page),
        str(page_size),
        sort or "default",
        _normalize_query(q) if q else "none",
    ]
    return "cat:" + _hash_key(*parts)


def cache_key_answer(query: str, equipment: Optional[str]) -> str:
    parts = ["answer", equipment or "all", _normalize_query(query)]
    return "ans:" + _hash_key(*parts)


def cache_key_catalog_list() -> str:
    return "cat:list:all"


# ----- Cache operations -----

async def _safe_get(key: str) -> Optional[str]:
    """Safely get a value from Redis, returning None on any error."""
    try:
        r = get_redis()
        return await r.get(key)
    except Exception:
        return None


async def _safe_set(key: str, value: str, ttl_seconds: int) -> bool:
    """Safely set a value in Redis, returning success status."""
    try:
        r = get_redis()
        await r.setex(key, ttl_seconds, value)
        return True
    except Exception:
        return False


async def get_cached(key: str) -> Optional[Any]:
    """Get JSON value from Redis."""
    val = await _safe_get(key)
    if val:
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return None
    return None


async def set_cached(key: str, value: Any, ttl_seconds: int = 300) -> bool:
    """Set JSON value in Redis with TTL (default 5 min)."""
    try:
        serialized = json.dumps(value, default=str)
        return await _safe_set(key, serialized, ttl_seconds)
    except (TypeError, ValueError):
        return False


async def invalidate_catalog_cache() -> None:
    """Invalidate all catalog-related keys."""
    try:
        r = get_redis()
        async for key in r.scan_iter(match="cat:*"):
            await r.delete(key)
    except Exception:
        pass


# ----- Specific cache helpers -----

async def get_catalog_list(
    equipment: Optional[str],
    page: int,
    page_size: int,
    sort: Optional[str],
    q: Optional[str],
) -> Optional[list]:
    key = cache_key_catalog(equipment, page, page_size, sort, q)
    return await get_cached(key)


async def set_catalog_list(
    equipment: Optional[str],
    page: int,
    page_size: int,
    sort: Optional[str],
    q: Optional[str],
    data: list,
    ttl: int = 300,
) -> bool:
    key = cache_key_catalog(equipment, page, page_size, sort, q)
    return await set_cached(key, data, ttl)


async def get_cached_answer(query: str, equipment: Optional[str]) -> Optional[dict]:
    """Get cached answer for a query (for repeated questions)."""
    key = cache_key_answer(query, equipment)
    return await get_cached(key)


async def set_cached_answer(query: str, equipment: Optional[str], answer: dict, ttl: int = 3600) -> bool:
    """Cache an answer for 1 hour by default."""
    key = cache_key_answer(query, equipment)
    return await set_cached(key, answer, ttl)


async def get_catalog_all_cached() -> Optional[list]:
    """Get cached full catalog list for dropdowns."""
    key = cache_key_catalog_list()
    return await get_cached(key)


async def set_catalog_all_cached(data: list, ttl: int = 600) -> bool:
    """Cache full catalog list for 10 min."""
    key = cache_key_catalog_list()
    return await set_cached(key, data, ttl)