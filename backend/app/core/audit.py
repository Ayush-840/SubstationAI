"""Append-only authentication audit log (AUTH_TRD §4, threat T14).

``log_event`` appends exactly one ``auth_events`` row per security-relevant
event and **never raises**: an audit failure must not break a sign-in,
logout or registration. Events are named in AUTH_TRD §4 (``register``,
``login_ok``, ``login_fail``, ``lockout``, ``refresh``, ``refresh_replay``,
``logout``, ``logout_all``, ...).

Never pass passwords, raw tokens or full request bodies in ``detail`` —
the row is readable by admins through the audit viewer.
"""

import logging
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.db.models import AuthEvent

logger = logging.getLogger(__name__)


def _client_meta(request: Request | None) -> tuple[str | None, str | None]:
    if request is None:
        return None, None
    ip = request.client.host if request.client else None
    # With uvicorn --proxy-headers (Render) client.host is already the real
    # client IP; user-agent is truncated to the column width.
    ua = request.headers.get("user-agent")
    return ip, (ua[:200] if ua else None)


def log_event(
    db: Session,
    event: str,
    *,
    user_id: int | None = None,
    request: Request | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    """Append one audit row. Swallows failures (logs a warning instead)."""
    ip, ua = _client_meta(request)
    try:
        db.add(
            AuthEvent(
                user_id=user_id,
                event=event,
                ip=ip,
                user_agent=ua,
                detail=detail or {},
            )
        )
        db.commit()
    except Exception:  # noqa: BLE001 — audit must never break the flow
        db.rollback()
        logger.warning("auth event %r was not recorded", event, exc_info=True)
