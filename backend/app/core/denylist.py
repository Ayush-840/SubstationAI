"""In-memory access-token deny-list (Day 6 B).

Logout deny-lists the access token's ``jti`` until the token would have
expired anyway, so a stolen bearer token dies immediately instead of
surviving its full ``JWT_EXPIRE_MINUTES`` window. Entries carry their own
expiry and are purged lazily, so the set cannot grow without bound.

The state lives in this process only — single-worker dev and deploy are
covered; Day 9 moves it to a shared Redis set so it also spans workers.
"""

import time

_jtis: dict[str, float] = {}  # jti -> expiry (epoch seconds)


def _purge(now: float) -> None:
    for jti in [jti for jti, exp in _jtis.items() if exp <= now]:
        _jtis.pop(jti, None)


def revoke(jti: str, exp: float | None = None) -> None:
    """Deny-list ``jti`` until ``exp`` (epoch seconds, defaults to +1 day)."""
    now = time.time()
    _purge(now)
    _jtis[jti] = float(exp) if exp is not None else now + 86400


def is_revoked(jti: str) -> bool:
    now = time.time()
    _purge(now)
    return jti in _jtis


def clear() -> None:
    """Drop every entry (process shutdown / test hygiene)."""
    _jtis.clear()
