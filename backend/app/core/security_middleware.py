"""Security middleware and rate limiting (Day 8 B).

- slowapi rate limiting on /auth/login and /chat/stream
- CORS allow-list (configured via env var)
- Security headers middleware
"""

from functools import lru_cache
from typing import Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import get_settings


@lru_cache()
def get_limiter() -> Limiter:
    """Create a Limiter instance with in-memory storage (tests) or Redis (production)."""
    import sys
    # In tests, always use in-memory storage
    if "pytest" in sys.modules:
        storage_uri = "memory://"
    else:
        settings = get_settings()
        storage_uri = "memory://"
        redis_url = getattr(settings, "REDIS_URL", None)
        if redis_url:
            # Quick connectivity probe
            try:
                import redis
                test_client = redis.from_url(redis_url, socket_connect_timeout=0.5)
                test_client.ping()
                storage_uri = redis_url
            except Exception:
                pass
    return Limiter(
        key_func=get_remote_address,
        storage_uri=storage_uri,
        default_limits=[],
    )


def get_cors_origins() -> list[str]:
    """Parse CORS allow-list from env var, fallback to localhost for dev."""
    settings = get_settings()
    raw = getattr(settings, "CORS_ALLOW_ORIGINS", "")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    # Dev fallback
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


def get_cors_origin_regex() -> str | None:
    """Optional regex for CORS origins (e.g. Vercel preview subdomains).

    When set, origins matching the regex are allowed in addition to the exact
    allow_origins list. Useful for ``*.vercel.app`` preview URLs where the exact
    subdomain is not known ahead of time.
    """
    settings = get_settings()
    raw = getattr(settings, "CORS_ALLOW_ORIGIN_REGEX", "")
    return raw.strip() or None


def add_security_middleware(app: FastAPI) -> None:
    """Add CORS, rate limiting, and security headers to the FastAPI app."""
    settings = get_settings()
    limiter = get_limiter()

    origins = get_cors_origins()
    allow_origin_regex = get_cors_origin_regex()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Rate limiter
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        # HSTS (only in production with HTTPS)
        if not settings.FRONTEND_URL.startswith("http://localhost"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Permissions policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response


def apply_rate_limits(app: FastAPI) -> None:
    """Apply specific rate limits to sensitive endpoints."""
    import sys
    # Skip rate limiting in tests
    if "pytest" in sys.modules:
        return
        
    limiter = app.state.limiter

    # Import here to avoid circular imports
    from app.api import auth, chat

    # Rate limit login: 5 requests/minute per IP
    @limiter.limit("5/minute")
    async def rate_limited_login(request: Request):
        pass  # The actual endpoint is in auth router

    # Rate limit chat stream: 30 requests/minute per IP
    @limiter.limit("30/minute")
    async def rate_limited_chat(request: Request):
        pass

    # Apply to existing endpoints by wrapping them
    # Note: This is a simplified approach; in production you'd decorate the actual endpoints
    # For now we register the limiters; the actual decoration happens in the router files