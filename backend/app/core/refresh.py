"""Refresh-token rotation and the browser cookie flow (Day 6 A).

Opaque, high-entropy refresh tokens are delivered two ways:

* **response body** — API clients, tests and the eval harness;
* **HttpOnly cookie** scoped to ``/api/auth`` — the browser flow documented
  in README §Authentication (Option A), with a readable ``csrf_token``
  companion cookie as its double-submit pair.

Only the SHA-256 hash of the token is stored server-side, so a leaked row
cannot be replayed as a session. Every refresh marks the presented row
``used_at`` and issues a successor in the same transaction (rotation). Any
request that presents the *cookie* must echo the CSRF cookie in
``X-CSRF-Token``; body-only clients are unaffected.
"""

import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import RefreshToken

settings = get_settings()

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "X-CSRF-Token"


def hash_token(raw: str) -> str:
    """SHA-256 hex digest — the only form persisted to the database."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _expires_at() -> datetime:
    return datetime.utcnow() + timedelta(days=settings.REFRESH_EXPIRE_DAYS)


def issue_refresh_token(db: Session, user_id: int) -> str:
    """Store a new hashed token and return the raw value to hand out."""
    raw = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(user_id=user_id, token_hash=hash_token(raw), expires_at=_expires_at())
    )
    db.commit()
    return raw


def find_valid_token(db: Session, raw: str) -> RefreshToken:
    """Look the token up by hash; reject revoked, used or expired rows."""
    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_token(raw))
        .first()
    )
    if row is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if row.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    if row.used_at is not None:
        # A rotated-out token coming back means either a client race (two tabs
        # refreshing at once) or a stolen copy. Inside the grace window assume
        # the race; outside it, assume theft and end every session for the user.
        age = (datetime.utcnow() - row.used_at).total_seconds()
        if age > settings.REFRESH_REUSE_GRACE_SECONDS:
            from app.core.audit import log_event  # local import: audit imports models

            log_event(
                db, "refresh_replay", user_id=row.user_id,
                detail={"token_id": row.id},
            )
            revoke_all_for_user(db, row.user_id)
            raise HTTPException(
                status_code=401, detail="Refresh token reuse detected; please sign in again"
            )
        raise HTTPException(status_code=401, detail="Refresh token already used")
    if row.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")
    return row


def rotate_refresh_token(db: Session, row: RefreshToken) -> str:
    """Consume ``row`` and insert its successor in one commit."""
    row.used_at = datetime.utcnow()
    raw = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=row.user_id, token_hash=hash_token(raw), expires_at=_expires_at()
        )
    )
    db.commit()
    return raw


def revoke_by_raw(db: Session, raw: str) -> bool:
    """Revoke one token (logout); ``False`` when no active row matched."""
    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_token(raw))
        .first()
    )
    if row is None or row.revoked_at is not None:
        return False
    row.revoked_at = datetime.utcnow()
    db.commit()
    return True


def revoke_all_for_user(db: Session, user_id: int) -> int:
    """Revoke every still-active token for the user (full logout)."""
    count = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.used_at.is_(None),
        )
        .update(
            {RefreshToken.revoked_at: datetime.utcnow()},
            synchronize_session=False,
        )
    )
    db.commit()
    return int(count)


def set_auth_cookies(response: Response, raw_refresh: str) -> None:
    """Deliver the browser flow: HttpOnly refresh + readable CSRF pair."""
    max_age = settings.REFRESH_EXPIRE_DAYS * 86400
    response.set_cookie(
        REFRESH_COOKIE,
        raw_refresh,
        max_age=max_age,
        path="/api/auth",
        httponly=True,
        secure=True,
        samesite="none",
    )
    response.set_cookie(
        CSRF_COOKIE,
        secrets.token_urlsafe(16),
        max_age=max_age,
        path="/",
        httponly=False,
        secure=True,
        samesite="none",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    response.delete_cookie(CSRF_COOKIE, path="/")


def require_csrf_for_cookie_flow(
    refresh_cookie: str | None, csrf_cookie: str | None, csrf_header: str | None
) -> None:
    """Double-submit check, enforced only when the refresh cookie is used.

    A body-only client never triggers it; a browser request that carries the
    refresh cookie must prove JS could read the companion cookie by echoing
    it in ``X-CSRF-Token``.
    """
    if refresh_cookie is None:
        return
    if (
        not csrf_cookie
        or not csrf_header
        or not secrets.compare_digest(csrf_cookie, csrf_header)
    ):
        raise HTTPException(
            status_code=403,
            detail="CSRF check failed: echo the csrf_token cookie in X-CSRF-Token",
        )
