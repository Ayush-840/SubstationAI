"""Outbound mail interface (AUTH_TRD Day 3).

Backends selected by ``MAIL_BACKEND``:

* ``console`` — print to stderr (default; local dev and tests, no network)
* ``smtp``    — any SMTP server via SMTP_HOST / SMTP_PORT / SMTP_*
* ``resend``  — Resend HTTP API (the recommended provider on Render, whose
  free tier blocks outbound SMTP on some ports; see AUTH_TRD §10)

Production refuses the console backend when e-mail verification is required
(checked in ``Settings.assert_production_ready``).
"""

import smtplib
import sys
from email.message import EmailMessage

from app.core.config import get_settings


def send_mail(to: str, subject: str, body: str) -> None:
    """Send ``body`` (plain text) from ``MAIL_FROM`` to ``to``.

    Raises on backend failure so callers can decide whether to surface the
    error (resend-verification) or degrade gracefully (register).
    """
    s = get_settings()
    backend = s.MAIL_BACKEND

    if backend == "console":
        print(
            f"[mail:console] from={s.MAIL_FROM} to={to} subject={subject}\n{body}",
            file=sys.stderr,
        )
        return

    if backend == "smtp":
        if not s.SMTP_HOST:
            raise RuntimeError("MAIL_BACKEND=smtp but SMTP_HOST is empty")
        msg = EmailMessage()
        msg["From"] = s.MAIL_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        if s.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(s.SMTP_HOST, s.SMTP_PORT, timeout=15) as srv:
                if s.SMTP_USER:
                    srv.login(s.SMTP_USER, s.SMTP_PASSWORD)
                srv.send_message(msg)
        else:
            with smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=15) as srv:
                if s.SMTP_STARTTLS:
                    srv.starttls()
                if s.SMTP_USER:
                    srv.login(s.SMTP_USER, s.SMTP_PASSWORD)
                srv.send_message(msg)
        return

    if backend == "resend":
        if not s.RESEND_API_KEY:
            raise RuntimeError("MAIL_BACKEND=resend but RESEND_API_KEY is empty")
        import httpx

        resp = httpx.post(
            "https://api.resend.com/emails",
            json={
                "from": s.MAIL_FROM,
                "to": [to],
                "subject": subject,
                "text": body,
            },
            headers={"Authorization": f"Bearer {s.RESEND_API_KEY}"},
            timeout=15,
        )
        resp.raise_for_status()
        return

    raise RuntimeError(f"Unknown MAIL_BACKEND: {backend!r} (console|smtp|resend)")
