"""Single-use one-time tokens (AUTH_TRD §6).

32 random URL-safe bytes are handed to the caller exactly once; only the
SHA-256 digest is stored.  Consumption marks ``used_at`` and flushes without
committing, so the caller can apply the authorised change and commit both in
one transaction — a crash can never consume the token without applying the
change (or vice versa).
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models import OneTimeToken

# Per-purpose lifetimes (AUTH_TRD §5.2).
PURPOSE_TTL = {
    "verify_email": timedelta(hours=24),
    "reset_password": timedelta(minutes=30),
}


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_one_time_token(db: Session, user_id: int, purpose: str) -> str:
    """Stage a new one-time token for ``user_id``; returns the raw value.

    Does not commit — the caller owns the transaction (e.g. register creates
    the user and the token together).
    """
    if purpose not in PURPOSE_TTL:
        raise ValueError(f"unknown one-time token purpose: {purpose!r}")
    raw = secrets.token_urlsafe(32)
    db.add(
        OneTimeToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=hash_token(raw),
            expires_at=datetime.utcnow() + PURPOSE_TTL[purpose],
        )
    )
    db.flush()
    return raw


def consume_one_time_token(
    db: Session, raw: str | None, purpose: str
) -> OneTimeToken | None:
    """Validate ``raw`` for ``purpose`` and mark it used (flushed, not committed).

    Returns None for missing / unknown / wrong-purpose / expired / already
    used tokens — callers map that to a uniform 400 so the endpoint never
    reveals why a token was rejected.
    """
    if not raw:
        return None
    digest = hash_token(raw)
    row = (
        db.query(OneTimeToken)
        .filter(
            OneTimeToken.token_hash == digest,
            OneTimeToken.purpose == purpose,
        )
        .first()
    )
    if row is None or row.used_at is not None:
        return None
    if not hmac.compare_digest(row.token_hash, digest):  # constant-time belt
        return None
    if row.expires_at <= datetime.utcnow():
        return None
    row.used_at = datetime.utcnow()
    db.flush()
    return row
