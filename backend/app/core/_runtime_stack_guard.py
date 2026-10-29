"""Guardrails for startup-time dependency availability.

The deployed backend has failed because a package was missing from the Docker
image even though it is imported at startup. This module centralises the
startup-time import checks so the failure is explicit and the missing module
name is visible in logs, instead of surfacing later as a KeyError or latent
AttributeError during the first request.

This is defensive logging/assertion only. It does not change what is installed;
that is decided by requirements.txt, requirements-heavy.txt, and the Dockerfiles.
"""

import sys
from typing import Dict

_missing: Dict[str, str] = {}


def _required(module_name: str, label: str) -> None:
    """Import `module_name` and record a clear message if it is unavailable."""
    try:
        __import__(module_name)
    except Exception:  # pragma: no cover - defensive startup guard
        _missing[module_name] = label


def check_runtime_stack() -> None:
    """Run every startup-time import check and exit if anything critical is missing.

    This is called early in the startup path (before uvicorn binds the port) so
    Render/Railway log the real cause instead of timing out on "No open ports".
    """
    # Packages that must be present for the app to start at all.
    _required("slowapi", "rate limiting / token deny-list support")
    _required("redis.asyncio", "Redis-backed deny-list and cache")
    _required("argon2", "password hashing (argon2id)")
    _required("pyotp", "TOTP two-factor authentication")
    _required("cryptography", "Fernet encryption for TOTP secrets")
    _required("google.oauth2.id_token", "Google Sign-In token verification")

    if _missing:
        lines = ["Missing runtime dependency(ies):"]
        for module, label in sorted(_missing.items()):
            lines.append(f"  - {module}  ({label})")
        msg = "\n".join(lines)
        print(msg, file=sys.stderr)
        # Hard fail so the container stops instead of binding and breaking later.
        sys.exit(1)
