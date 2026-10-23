"""Redis-backed access-token deny-list (Day 9).

Replaces the in-memory set with a Redis sorted set (ZSET) keyed by expiry timestamp.
This allows the deny-list to work across multiple backend workers and persist
across restarts (until token expiry).
"""

import time
from typing import Optional

from app.cache.redis_cache import get_redis


DENYLIST_KEY = "denylist:access_tokens"


async def revoke(jti: str, exp: Optional[float] = None) -> None:
    """Deny-list ``jti`` until ``exp`` (epoch seconds, defaults to +1 day)."""
    r = await get_redis()
    now = time.time()
    expiry = float(exp) if exp is not None else now + 86400
    # Use ZSET with expiry as score for efficient range queries
    await r.zadd(DENYLIST_KEY, {jti: expiry})
    # Set a TTL on the key slightly longer than the longest token
    await r.expire(DENYLIST_KEY, 86400 + 3600)


async def is_revoked(jti: str) -> bool:
    """Check if ``jti`` is in the deny-list and not expired."""
    r = await get_redis()
    now = time.time()
    # Remove expired entries first
    await r.zremrangebyscore(DENYLIST_KEY, 0, now)
    # Check membership
    return await r.zscore(DENYLIST_KEY, jti) is not None


async def clear() -> None:
    """Drop the entire deny-list (process shutdown / test hygiene)."""
    r = await get_redis()
    await r.delete(DENYLIST_KEY)