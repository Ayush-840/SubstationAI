"""Access-token deny-list (Day 6 B, Day 9 Redis).

Uses Redis sorted set (ZSET) when Redis is available; falls back to in-memory
for tests or when Redis is unavailable.
"""

import time
import sys
from typing import Optional

from app.cache.redis_cache import get_redis


DENYLIST_KEY = "denylist:access_tokens"

# In-memory fallback for tests / no Redis
_memory_denylist: dict[str, float] = {}


async def _use_redis() -> bool:
    """Check if Redis is available (and not in test mode)."""
    if "pytest" in sys.modules:
        return False
    try:
        r = await get_redis()
        await r.ping()
        return True
    except Exception:
        return False


async def revoke(jti: str, exp: Optional[float] = None) -> None:
    """Deny-list ``jti`` until ``exp`` (epoch seconds, defaults to +1 day)."""
    use_redis = await _use_redis()
    if use_redis:
        r = await get_redis()
        now = time.time()
        expiry = float(exp) if exp is not None else now + 86400
        await r.zadd("denylist:access_tokens", {jti: expiry})
        await r.expire("denylist:access_tokens", 86400 + 3600)
    else:
        now = time.time()
        _memory_denylist[jti] = float(exp) if exp is not None else now + 86400


async def is_revoked(jti: str) -> bool:
    """Check if ``jti`` is in the deny-list and not expired."""
    use_redis = await _use_redis()
    if use_redis:
        r = await get_redis()
        now = time.time()
        await r.zremrangebyscore("denylist:access_tokens", 0, now)
        return await r.zscore("denylist:access_tokens", jti) is not None
    else:
        now = time.time()
        # Clean expired
        expired = [k for k, v in _memory_denylist.items() if v <= now]
        for k in expired:
            _memory_denylist.pop(k, None)
        return jti in _memory_denylist


async def clear() -> None:
    """Drop the entire deny-list (process shutdown / test hygiene)."""
    try:
        r = await get_redis()
        await r.delete("denylist:access_tokens")
    except Exception:
        pass
    _memory_denylist.clear()