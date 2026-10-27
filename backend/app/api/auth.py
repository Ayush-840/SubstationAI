"""Register / login / refresh / logout / me.

Behaviour is specified in AUTH_TRD.md; the short version:

* emails are case-insensitive (stored lower-case, looked up with lower());
* register -> 201, duplicate -> 409, weak input -> 422 (see schemas.UserCreate);
* login is throttled per (IP, email) on *failures* and never says whether the
  email or the password was wrong;
* the access token is short-lived; the refresh token rotates on every use and a
  replayed one ends all of the user's sessions;
* logout works even when the access token has already expired.
"""

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.denylist import revoke as revoke_jti
from app.core.login_throttle import record_failure, record_success, retry_after
from app.core.refresh import (
    CSRF_COOKIE,
    CSRF_HEADER,
    REFRESH_COOKIE,
    clear_auth_cookies,
    find_valid_token,
    issue_refresh_token,
    require_csrf_for_cookie_flow,
    revoke_all_for_user,
    revoke_by_raw,
    rotate_refresh_token,
    set_auth_cookies,
)
from app.core.security import (
    create_access_token,
    decode_token,
    get_current_user,
    get_password_hash,
    oauth2_scheme_optional,
    verify_password,
)
from app.core.security_middleware import get_limiter
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas import (
    LogoutRequest,
    RefreshRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)

settings = get_settings()
limiter = get_limiter()

router = APIRouter(prefix="/api/auth", tags=["auth"])

_dummy_hash: str | None = None


def _burn_hash_time(password: str) -> None:
    """Run a bcrypt verify against a fixed hash so an unknown email costs the
    same time as a wrong password (no user enumeration through latency)."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = get_password_hash("timing-equaliser-not-a-real-password")
    verify_password(password, _dummy_hash)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _token_response(user: User, refresh_raw: str) -> dict:
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "token_type": "bearer",
        "refresh_token": refresh_raw,
    }


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_REGISTER)
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    # user_data.email is already stripped and lower-cased by the schema.
    exists = db.query(User.id).filter(func.lower(User.email) == user_data.email).first()
    if exists:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=UserRole.TRAINEE,  # public sign-up can never choose a role
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # two simultaneous sign-ups for the same email
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(
    request: Request,
    credentials: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    wait = retry_after(ip, credentials.email)
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {wait} seconds.",
            headers={"Retry-After": str(wait)},
        )

    user = (
        db.query(User)
        .filter(func.lower(User.email) == credentials.email)
        .order_by(User.id)
        .first()
    )
    if user is None:
        _burn_hash_time(credentials.password)
        record_failure(ip, credentials.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(credentials.password, user.password_hash):
        record_failure(ip, credentials.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    record_success(ip, credentials.email)
    refresh_raw = issue_refresh_token(db, user.id)
    set_auth_cookies(response, refresh_raw)
    return _token_response(user, refresh_raw)


@router.post("/refresh", response_model=Token)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    body: RefreshRequest | None = None,
    refresh_cookie: str | None = Cookie(None, alias=REFRESH_COOKIE),
    csrf_cookie: str | None = Cookie(None, alias=CSRF_COOKIE),
    csrf_header: str | None = Header(None, alias=CSRF_HEADER),
):
    """Exchange a refresh token for a new access + refresh pair (rotation).

    The body carries the token for API clients and the SPA; the HttpOnly cookie
    flow (same-site deployments) must pass the CSRF double-submit check first.
    A replayed (already rotated) token ends every session of that user.
    """
    if body is not None and body.refresh_token:
        raw = body.refresh_token
    else:
        require_csrf_for_cookie_flow(refresh_cookie, csrf_cookie, csrf_header)
        raw = refresh_cookie
    if not raw:
        raise HTTPException(status_code=401, detail="Refresh token required")

    row = find_valid_token(db, raw)
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    refresh_raw = rotate_refresh_token(db, row)
    set_auth_cookies(response, refresh_raw)
    return _token_response(user, refresh_raw)


@router.post("/logout")
async def logout(
    response: Response,
    db: Session = Depends(get_db),
    raw_token: str | None = Depends(oauth2_scheme_optional),
    body: LogoutRequest | None = None,
    refresh_cookie: str | None = Cookie(None, alias=REFRESH_COOKIE),
    csrf_cookie: str | None = Cookie(None, alias=CSRF_COOKIE),
    csrf_header: str | None = Header(None, alias=CSRF_HEADER),
):
    """End the session on both sides. Idempotent.

    * the access token's ``jti`` is deny-listed until the token's own expiry
      (an already-expired token is accepted here, otherwise a user whose token
      lapsed could never sign out);
    * the refresh token from the body (or cookie, after the CSRF check) is
      revoked; with neither supplied, every active refresh token of the user
      is revoked.
    """
    user_id = None
    if raw_token:
        payload = decode_token(raw_token, verify_exp=False)  # signature still checked
        user_id = payload.get("sub")
        jti, exp = payload.get("jti"), payload.get("exp")
        if jti:
            # Must be awaited: the deny-list is async (Redis). The previous
            # sync call created a coroutine that never ran, so logout did not
            # actually revoke the access token.
            await revoke_jti(jti, float(exp) if exp is not None else None)

    revoked = 0
    if body is not None and body.refresh_token:
        revoked = int(revoke_by_raw(db, body.refresh_token))
    elif refresh_cookie is not None:
        require_csrf_for_cookie_flow(refresh_cookie, csrf_cookie, csrf_header)
        revoked = int(revoke_by_raw(db, refresh_cookie))
    elif user_id is not None:
        revoked = revoke_all_for_user(db, int(user_id))
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")

    clear_auth_cookies(response)
    return {"ok": True, "revoked_refresh_tokens": revoked}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
