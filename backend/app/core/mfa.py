"""TOTP two-factor helpers (AUTH_TRD Day 7, §6 tokens).

Secrets are generated as standard base32, stored Fernet-encrypted at rest
(``TOTP_ENCRYPTION_KEY``; a stable key derived from JWT_SECRET in dev) and
verified with a ±1 step window. Each accepted code consumes its timestep
(``totp_last_timestep``), so a code can never be replayed inside its window
(A-06). Recovery codes are single-use SHA-256 rows (A-07).
"""

import base64
import hashlib
import re
import secrets
import time
from datetime import datetime, timezone

import pyotp
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import RecoveryCode

# Steps (±1) accepted around "now": the current 30 s step and the previous
# one — two steps old is rejected (A-06).
TOTP_STEP_SECONDS = 30
TOTP_VALID_DELTA = 1

# Recovery codes: 10 chars, ambiguous glyphs (0/O/1/I/L) removed, shown as
# XXXXX-XXXXX.
_RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
RECOVERY_CODE_COUNT = 10


def get_fernet() -> Fernet:
    """The Fernet protecting TOTP secrets.

    Production always has an explicit ``TOTP_ENCRYPTION_KEY`` (boot check).
    Without one, a stable key is derived from JWT_SECRET so local dev and
    tests work with zero configuration and survive restarts.
    """
    key = get_settings().TOTP_ENCRYPTION_KEY
    if key:
        return Fernet(key.encode("utf-8"))
    digest = hashlib.sha256(get_settings().JWT_SECRET.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(secret: str) -> str:
    return get_fernet().encrypt(secret.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    try:
        return get_fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("TOTP secret could not be decrypted (key changed?)") from exc


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def otpauth_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email, issuer_name="SubstationIQ"
    )


def _normalise_code(code: str) -> str:
    return re.sub(r"\s+", "", code or "")


def verify_totp_code(
    secret: str,
    code: str,
    last_timestep: int | None,
    now: float | None = None,
) -> int | None:
    """Accept ``code`` for the current or previous step unless that step was
    already consumed. Returns the accepted timestep, or None to reject.

    ``now`` is injectable for deterministic tests (A-06); production callers
    leave it None and use the real clock.
    """
    code = _normalise_code(code)
    if not (code.isdigit() and len(code) in (6, 8)):
        return None
    current = int(time.time()) if now is None else int(now)
    totp = pyotp.TOTP(secret)
    for delta in range(0, -(TOTP_VALID_DELTA + 1), -1):
        for_time = current + delta * TOTP_STEP_SECONDS
        if not totp.verify(code, for_time=for_time, valid_window=0):
            continue
        step = totp.timecode(datetime.fromtimestamp(for_time, tz=timezone.utc))
        if last_timestep is not None and step <= last_timestep:
            return None  # replay of a code that was already accepted (A-06)
        return step
    return None


def generate_recovery_code() -> str:
    body = "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(10))
    return f"{body[:5]}-{body[5:]}"


def hash_recovery_code(code: str) -> str:
    normalised = re.sub(r"[^0-9A-Za-z]", "", code or "").upper()
    return hashlib.sha256(normalised.encode("utf-8")).hexdigest()


def consume_recovery_code(db: Session, user_id: int, code: str) -> bool:
    """Spend one recovery code (flushed, not committed — the caller commits
    together with the effect it authorises). Second use → False (A-07)."""
    row = (
        db.query(RecoveryCode)
        .filter(
            RecoveryCode.user_id == user_id,
            RecoveryCode.code_hash == hash_recovery_code(code),
            RecoveryCode.used_at.is_(None),
        )
        .first()
    )
    if row is None:
        return False
    row.used_at = datetime.utcnow()
    db.flush()
    return True
