"""Security middleware: CORS allow-list, rate limiting, security headers.

Design notes (see AUTH_TRD.md §9):

* CORS origins come from ``Settings`` — the previous version read
  ``CORS_ALLOW_ORIGINS`` with ``getattr`` on a model that had no such field, so
  the deployed frontend was silently blocked. ``FRONTEND_URL`` is always allowed
  too, and ``https://*.example.app`` style wildcards are compiled to a regex
  (Starlette's ``allow_origins`` only does exact matching).
* Rate limits are read from settings; the limiter uses Redis storage when
  ``REDIS_URL`` is reachable and in-memory storage otherwise.
* The client IP is whatever uvicorn reports. Behind a reverse proxy (Render)
  start uvicorn with ``--proxy-headers --forwarded-allow-ips='*'`` so every user
  does not share the proxy's IP (and therefore one rate-limit bucket).
"""

import re
import sys
from functools import lru_cache

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings

DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


@lru_cache()
def get_limiter() -> Limiter:
    """Limiter with Redis storage when reachable, in-memory otherwise."""
    storage_uri = "memory://"
    if "pytest" not in sys.modules:
        redis_url = get_settings().REDIS_URL
        if redis_url:
            try:
                import redis  # local import: only needed when configured

                redis.from_url(redis_url, socket_connect_timeout=0.5).ping()
                storage_uri = redis_url
            except Exception:
                pass  # fall back to per-process memory
    return Limiter(key_func=get_remote_address, storage_uri=storage_uri, default_limits=[])


def parse_cors(raw: str, frontend_url: str = "", production: bool = False) -> tuple[list[str], str | None]:
    """Split the allow-list into exact origins and one compiled wildcard regex."""
    items = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    if frontend_url:
        items.append(frontend_url.strip().rstrip("/"))
    if not production:
        items.extend(DEV_ORIGINS)

    exact: list[str] = []
    patterns: list[str] = []
    for origin in dict.fromkeys(items):  # de-duplicate, keep order
        if "*" in origin:
            # '*' matches exactly one DNS label, never a dot or a slash.
            patterns.append(re.escape(origin).replace(r"\*", "[a-z0-9-]+"))
        else:
            exact.append(origin)
    regex = "^(?:" + "|".join(patterns) + ")$" if patterns else None
    return exact, regex


def build_cors(settings) -> tuple[list[str], str | None]:
    """Exact origins + one combined regex from CORS_ALLOW_ORIGINS (wildcards) and
    CORS_ALLOW_ORIGIN_REGEX (a raw regex, matched against the whole origin)."""
    exact, regex = parse_cors(settings.CORS_ALLOW_ORIGINS, settings.FRONTEND_URL, settings.is_production)
    extra = (settings.CORS_ALLOW_ORIGIN_REGEX or "").strip()
    if extra:
        re.compile(extra)  # fail at startup, not on the first preflight, if the pattern is invalid
        regex = f"(?:{regex})|(?:{extra})" if regex else extra
    return exact, regex


def get_cors_origins() -> list[str]:
    """Exact origins currently allowed (kept for tests and diagnostics)."""
    s = get_settings()
    return parse_cors(s.CORS_ALLOW_ORIGINS, s.FRONTEND_URL, s.is_production)[0]


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 in the same ``{"detail": ...}`` shape as every other error."""
    return JSONResponse(
        status_code=429,
        content={"detail": f"Too many requests ({exc.detail}). Please wait and try again."},
        headers={"Retry-After": "60"},
    )


def add_security_middleware(app: FastAPI) -> None:
    settings = get_settings()
    origins, origin_regex = build_cors(settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
        max_age=600,
    )

    app.state.limiter = get_limiter()
    app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # Day 10 (threat T5): this service answers JSON/SSE only — the SPA is
        # a separate origin with its own headers. Nothing here may run script,
        # embed or be embedded, so an allow-nothing CSP is the strictest
        # correct policy.
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        )
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if request.url.path.startswith("/api/auth/"):
            # Token responses must never sit in a shared or browser cache.
            response.headers["Cache-Control"] = "no-store"
        return response
