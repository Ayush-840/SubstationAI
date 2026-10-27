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

from datetime import datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import log_event
from app.core.config import get_settings
from app.core.denylist import revoke as revoke_jti
from app.core.login_throttle import record_failure, record_success, retry_after
from app.core.mail import send_mail
from app.core.refresh import (
    CSRF_COOKIE,
    CSRF_HEADER,
    REFRESH_COOKIE,
    clear_auth_cookies,
    find_valid_token,
    hash_token,
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
    password_hash_needs_upgrade,
    oauth2_scheme_optional,
    verify_password,
)
from app.core.security_middleware import get_limiter
from app.core.tokens import consume_one_time_token, create_one_time_token
from app.db.models import OneTimeToken, RefreshToken, User, UserRole
from app.db.session import get_db
from app.schemas import (
    ForgotPasswordIn,
    LogoutRequest,
    PasswordChangeIn,
    PasswordResetIn,
    RefreshRequest,
    ResendVerificationIn,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
    VerifyEmailIn,
)

settings = get_settings()
limiter = get_limiter()

router = APIRouter(prefix="/api/auth", tags=["auth"])

_dummy_hash: str | None = None

# §6: verification mails per e-mail per hour — excess silently dropped (202).
_RESEND_PER_HOUR = 3


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


def _send_verification_mail(user: User, raw_token: str) -> None:
    """Send the confirmation link. The token rides in the URL *fragment* so it
    never appears in server/proxy logs (§7.6). A transport failure is logged
    and swallowed: registration must not depend on a third party (§6)."""
    link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email#token={raw_token}"
    body = (
        f"Hi {user.name},\n\n"
        "Confirm your e-mail address for SubstationIQ:\n\n"
        f"{link}\n\n"
        "If you did not create this account you can ignore this message.\n"
    )
    try:
        send_mail(user.email, "Confirm your SubstationIQ e-mail", body)
    except Exception:
        import logging

        logging.getLogger(__name__).exception(
            "verification mail failed for user_id=%s", user.id
        )


def _send_reset_mail(user: User, raw_token: str) -> None:
    """Reset link with the token in the fragment (§7.6); failures logged,
    never raised (§6 fail-open — an unreachable mail provider must not break
    the endpoint, the rate cap still applies on retry)."""
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password#token={raw_token}"
    body = (
        f"Hi {user.name},\n\n"
        "Reset your SubstationIQ password (valid for 30 minutes):\n\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this message — your "
        "password has not changed.\n"
    )
    try:
        send_mail(user.email, "Reset your SubstationIQ password", body)
    except Exception:
        import logging

        logging.getLogger(__name__).exception(
            "reset mail failed for user_id=%s", user.id
        )


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
    log_event(db, "register", user_id=user.id, request=request, detail={"email": user.email})
    raw_token = create_one_time_token(db, user.id, "verify_email")
    db.commit()  # user + verify token in one transaction
    _send_verification_mail(user, raw_token)
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
        locked = record_failure(ip, credentials.email)
        log_event(db, "login_fail", request=request, detail={"email": credentials.email})
        if locked:
            log_event(db, "lockout", request=request, detail={"email": credentials.email})
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(credentials.password, user.password_hash):
        locked = record_failure(ip, credentials.email)
        log_event(
            db, "login_fail", user_id=user.id, request=request,
            detail={"email": credentials.email},
        )
        if locked:
            log_event(
                db, "lockout", user_id=user.id, request=request,
                detail={"email": credentials.email},
            )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if password_hash_needs_upgrade(user.password_hash):
        # Legacy bcrypt row: transparently re-hash to argon2id now that the
        # correct password is in hand (AUTH_TRD Day 2, A-10).
        user.password_hash = get_password_hash(credentials.password)
        db.commit()

    if settings.REQUIRE_EMAIL_VERIFICATION and user.email_verified_at is None:
        # A-02: credentials are correct but the address was never confirmed
        # (§5.2). No login_fail is recorded — the password was right, so this
        # must not count towards the lockout.
        raise HTTPException(status_code=403, detail="email_not_verified")

    record_success(ip, credentials.email)
    refresh_raw = issue_refresh_token(
        db, user.id,
        user_agent=request.headers.get("user-agent"),
        ip=ip,
    )
    set_auth_cookies(response, refresh_raw)
    log_event(db, "login_ok", user_id=user.id, request=request)
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
    if settings.REQUIRE_EMAIL_VERIFICATION and user.email_verified_at is None:
        # §6: a refresh token cannot resurrect an unverified session.
        raise HTTPException(status_code=401, detail="Email not verified")

    refresh_raw = rotate_refresh_token(db, row)
    set_auth_cookies(response, refresh_raw)
    log_event(db, "refresh", user_id=user.id, detail={"token_id": row.id})
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
    event = "logout"
    if body is not None and body.refresh_token:
        revoked = int(revoke_by_raw(db, body.refresh_token))
    elif refresh_cookie is not None:
        require_csrf_for_cookie_flow(refresh_cookie, csrf_cookie, csrf_header)
        revoked = int(revoke_by_raw(db, refresh_cookie))
    elif user_id is not None:
        revoked = revoke_all_for_user(db, int(user_id))
        event = "logout_all"
    else:
        raise HTTPException(status_code=401, detail="Not authenticated")

    log_event(
        db, event, user_id=int(user_id) if user_id is not None else None,
        detail={"revoked_refresh_tokens": revoked},
    )
    clear_auth_cookies(response)
    return {"ok": True, "revoked_refresh_tokens": revoked}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/verify-email")
def verify_email(
    payload: VerifyEmailIn, request: Request, db: Session = Depends(get_db)
):
    """Confirm the address: consume the single-use token and stamp
    ``email_verified_at``. Token used twice / expired / unknown → uniform 400
    (A-03), so the response never says why a token was rejected."""
    row = consume_one_time_token(db, payload.token, "verify_email")
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    if user.email_verified_at is None:
        user.email_verified_at = datetime.utcnow()
    # used_at (flushed by consume) + verified_at commit together (§6).
    db.commit()
    log_event(db, "email_verified", user_id=user.id, request=request)
    return {"ok": True, "email": user.email}


@router.post("/resend-verification", status_code=202)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def resend_verification(
    payload: ResendVerificationIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """Always 202 with an identical body for unknown, verified and throttled
    addresses — the response must not reveal who has an account (§6).
    Max 3 verification mails per e-mail per hour; excess is silently dropped."""
    response_body = {
        "detail": "If that address can receive e-mail, a verification link has been sent"
    }
    user = (
        db.query(User).filter(func.lower(User.email) == payload.email).first()
    )
    if user is None or user.email_verified_at is not None:
        return response_body

    cutoff = datetime.utcnow() - timedelta(hours=1)
    sent = (
        db.query(OneTimeToken.id)
        .filter(
            OneTimeToken.user_id == user.id,
            OneTimeToken.purpose == "verify_email",
            OneTimeToken.created_at >= cutoff,
        )
        .count()
    )
    if sent < _RESEND_PER_HOUR:
        raw_token = create_one_time_token(db, user.id, "verify_email")
        db.commit()
        _send_verification_mail(user, raw_token)
    return response_body


@router.post("/password/forgot", status_code=202)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def forgot_password(
    payload: ForgotPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """Always 202 with an identical body for unknown and known addresses
    (A-04, §6 no enumeration). Max 3 reset mails per e-mail per hour;
    excess is silently dropped, still 202."""
    response_body = {
        "detail": "If that address has an account, a reset link has been sent"
    }
    user = (
        db.query(User).filter(func.lower(User.email) == payload.email).first()
    )
    log_event(
        db, "password_reset_request",
        user_id=user.id if user is not None else None,
        request=request, detail={"email": payload.email},
    )
    if user is None:
        return response_body

    cutoff = datetime.utcnow() - timedelta(hours=1)
    sent = (
        db.query(OneTimeToken.id)
        .filter(
            OneTimeToken.user_id == user.id,
            OneTimeToken.purpose == "reset_password",
            OneTimeToken.created_at >= cutoff,
        )
        .count()
    )
    if sent < _RESEND_PER_HOUR:
        raw_token = create_one_time_token(db, user.id, "reset_password")
        db.commit()
        _send_reset_mail(user, raw_token)
    return response_body


@router.post("/password/reset")
def reset_password(
    payload: PasswordResetIn,
    request: Request,
    db: Session = Depends(get_db),
):
    """Consume the single-use 30-min token, set the new hash and revoke
    EVERY session of the user in one transaction (A-05, §6). Invalid,
    expired or reused tokens → uniform 400."""
    row = consume_one_time_token(db, payload.token, "reset_password")
    if row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.password_hash = get_password_hash(payload.new_password)
    user.password_changed_at = datetime.utcnow()
    # commit=False: used_at (flushed by consume) + hash + revokes land together
    revoked = revoke_all_for_user(db, user.id, commit=False)
    db.commit()
    log_event(
        db, "password_reset_done", user_id=user.id, request=request,
        detail={"revoked_refresh_tokens": revoked},
    )
    return {"ok": True, "revoked_refresh_tokens": revoked}


@router.post("/password/change")
def change_password(
    payload: PasswordChangeIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-authenticate with the current password, then swap it. Every other
    session is revoked; the caller's own session (identified by its refresh
    token) survives (A-09)."""
    if not verify_password(payload.current_password, current_user.password_hash):
        record_failure(_client_ip(request), current_user.email)
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    current_user.password_hash = get_password_hash(payload.new_password)
    current_user.password_changed_at = datetime.utcnow()
    keep = hash_token(payload.refresh_token) if payload.refresh_token else None
    revoked = revoke_all_for_user(
        db, current_user.id, keep_token_hash=keep, commit=False
    )
    db.commit()
    log_event(
        db, "password_change", user_id=current_user.id, request=request,
        detail={"revoked_refresh_tokens": revoked, "kept_current_session": keep is not None},
    )
    return {"ok": True, "revoked_refresh_tokens": revoked}


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_refresh_token: str | None = Header(None, alias="X-Refresh-Token"),
):
    """One entry per refresh family (one browser device): UA, IP, when the
    session started and when it was last active. The caller may pass its own
    refresh token in ``X-Refresh-Token`` (never a query string, §7.6) so the
    matching entry is flagged ``current``."""
    rows = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.utcnow(),
        )
        .order_by(RefreshToken.id)
        .all()
    )
    current_hash = hash_token(x_refresh_token) if x_refresh_token else None

    families: dict[str, dict] = {}
    for tok in rows:
        # A legacy row without a family still shows up as its own session.
        key = tok.family_id or f"tok:{tok.id}"
        active = tok.used_at is None
        entry = families.get(key)
        if entry is None:
            entry = families[key] = {
                "family_id": tok.family_id or str(tok.id),
                "user_agent": tok.user_agent,
                "ip": tok.ip,
                "created_at": tok.created_at,
                "last_used_at": tok.created_at,
                "active": False,
                "current": False,
            }
        activity = tok.last_used_at or tok.created_at
        if activity and activity > entry["last_used_at"]:
            entry["last_used_at"] = activity
        if tok.created_at and tok.created_at < entry["created_at"]:
            entry["created_at"] = tok.created_at
        if tok.user_agent and not entry["user_agent"]:
            entry["user_agent"] = tok.user_agent
        if tok.ip and not entry["ip"]:
            entry["ip"] = tok.ip
        if active:
            entry["active"] = True
        if current_hash and tok.token_hash == current_hash:
            entry["current"] = True

    # Only living sessions are interesting; newest activity first.
    sessions = sorted(
        (e for e in families.values() if e["active"]),
        key=lambda e: e["last_used_at"] or e["created_at"],
        reverse=True,
    )
    return {"sessions": sessions}


@router.delete("/sessions/{family_id}")
def revoke_session(
    family_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke one device's session (every token of the family). Another
    user's family id is indistinguishable from a missing one (404)."""
    count = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
        .update(
            {RefreshToken.revoked_at: datetime.utcnow()},
            synchronize_session=False,
        )
    )
    if count == 0:
        exists = (
            db.query(RefreshToken.id)
            .filter(
                RefreshToken.user_id == current_user.id,
                RefreshToken.family_id == family_id,
            )
            .first()
        )
        if exists is None:
            raise HTTPException(status_code=404, detail="Session not found")
    db.commit()
    return {"ok": True, "revoked_refresh_tokens": int(count)}


@router.post("/logout-all")
async def logout_all(
    response: Response,
    db: Session = Depends(get_db),
    raw_token: str | None = Depends(oauth2_scheme_optional),
):
    """Revoke every session of the user and deny-list this access token."""
    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(raw_token, verify_exp=False)
    user_id = payload.get("sub")
    jti, exp = payload.get("jti"), payload.get("exp")
    if jti:
        await revoke_jti(jti, float(exp) if exp is not None else None)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    revoked = revoke_all_for_user(db, int(user_id))
    log_event(
        db, "logout_all", user_id=int(user_id),
        detail={"revoked_refresh_tokens": revoked},
    )
    clear_auth_cookies(response)
    return {"ok": True, "revoked_refresh_tokens": revoked}
