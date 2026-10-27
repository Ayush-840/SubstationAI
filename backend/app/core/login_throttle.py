"""Failed-login throttle keyed by (client IP, email).

slowapi limits requests per IP, which both punishes users who log in
successfully a few times and does nothing against one attacker rotating
through accounts. This throttle counts only *failures*, per (IP, email) pair,
and clears the counter on success:

* after ``LOGIN_MAX_FAILURES`` failures the pair is locked for
  ``LOGIN_LOCKOUT_SECONDS`` (HTTP 429 + ``Retry-After``);
* keying on IP as well as email means an attacker cannot lock a victim out
  of their own account from another network.

State is in process memory: correct for a single instance (Render free tier,
docker-compose). A multi-instance deployment should move this to Redis
(INCR + EXPIRE) -- see AUTH_TRD.md section 8.
"""

import threading
import time

from app.core.config import get_settings

_lock = threading.Lock()
_failures: dict[str, tuple[int, float]] = {}  # key -> (count, window_start)
_locked_until: dict[str, float] = {}


def _key(ip: str, email: str) -> str:
    return f"{ip}|{email.strip().lower()}"


def retry_after(ip: str, email: str) -> int:
    """Seconds the caller must wait, or 0 when login may be attempted."""
    k = _key(ip, email)
    now = time.time()
    with _lock:
        until = _locked_until.get(k)
        if until is None:
            return 0
        if until <= now:
            _locked_until.pop(k, None)
            _failures.pop(k, None)
            return 0
        return int(until - now) + 1


def record_failure(ip: str, email: str) -> bool:
    """Count one failed attempt; ``True`` when this failure triggered a lock."""
    s = get_settings()
    k = _key(ip, email)
    now = time.time()
    locked_now = False
    with _lock:
        count, start = _failures.get(k, (0, now))
        if now - start > s.LOGIN_LOCKOUT_SECONDS:
            count, start = 0, now  # old failures age out
        count += 1
        _failures[k] = (count, start)
        if count >= s.LOGIN_MAX_FAILURES and k not in _locked_until:
            _locked_until[k] = now + s.LOGIN_LOCKOUT_SECONDS
            locked_now = True
        if len(_failures) > 10_000:  # bound memory under a spray attack
            for old in [x for x, (_, st) in _failures.items() if now - st > s.LOGIN_LOCKOUT_SECONDS]:
                _failures.pop(old, None)
                _locked_until.pop(old, None)
    return locked_now


def record_success(ip: str, email: str) -> None:
    k = _key(ip, email)
    with _lock:
        _failures.pop(k, None)
        _locked_until.pop(k, None)


def reset() -> None:
    """Test hygiene."""
    with _lock:
        _failures.clear()
        _locked_until.clear()
