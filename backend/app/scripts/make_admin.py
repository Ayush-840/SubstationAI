"""Offline recovery: promote a user to admin from the server shell.

The one thing an admin UI must never have is a "make me admin" button — if
every admin locks themselves out (or is demoted by mistake), ops recovers
with::

    python -m app.scripts.make_admin user@example.com

Idempotent: an existing admin is simply confirmed. Also re-enables a
disabled account, because an inactive admin cannot help anyone.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func  # noqa: E402

from app.core.audit import log_event  # noqa: E402
from app.db.models import User, UserRole  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def make_admin(email: str) -> int:
    """Promote ``email`` to admin. Returns a process exit code."""
    email = email.strip().lower()
    if not email:
        print("usage: python -m app.scripts.make_admin <email>", file=sys.stderr)
        return 2

    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(func.lower(User.email) == email)
            .order_by(User.id)
            .first()
        )
        if user is None:
            print(f"no account with email {email!r}", file=sys.stderr)
            return 1

        was = user.role
        user.role = UserRole.ADMIN
        if user.is_active is False:
            user.is_active = True
            print(f"re-enabled disabled account {email}")
        if was != UserRole.ADMIN:
            log_event(
                db, "role_change", user_id=user.id,
                detail={"from": was.value, "to": "admin", "actor": "make_admin_cli"},
            )
            db.commit()
            print(f"promoted {email} to admin")
        else:
            print(f"{email} is already an admin")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    raise SystemExit(make_admin(args[0] if args else ""))
