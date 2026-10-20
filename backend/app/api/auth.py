from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User, UserRole
from app.core.denylist import revoke as revoke_jti
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
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    get_current_user,
    oauth2_scheme,
)
from app.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    RefreshRequest,
    LogoutRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=UserRole.USER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(
    credentials: UserLogin, response: Response, db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    refresh_raw = issue_refresh_token(db, user.id)
    set_auth_cookies(response, refresh_raw)
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "token_type": "bearer",
        "refresh_token": refresh_raw,
    }


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

    The body carries the token for API clients; browsers use the HttpOnly
    cookie and must pass the CSRF double-submit check first.
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
    return {
        "access_token": create_access_token({"sub": str(user.id)}),
        "token_type": "bearer",
        "refresh_token": refresh_raw,
    }


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    raw_token: str = Depends(oauth2_scheme),
    body: LogoutRequest | None = None,
    refresh_cookie: str | None = Cookie(None, alias=REFRESH_COOKIE),
    csrf_cookie: str | None = Cookie(None, alias=CSRF_COOKIE),
    csrf_header: str | None = Header(None, alias=CSRF_HEADER),
):
    """Kill the session on both sides (Day 6 B).

    The access token's ``jti`` is deny-listed until the token's own expiry,
    so it stops working immediately; the refresh token named in the body (or
    the cookie, after the CSRF check) is revoked, or all of the user's active
    refresh tokens when neither is supplied. Idempotent: logging out twice
    still succeeds. The deny-list lives in memory until Day 9 moves it to
    Redis.
    """
    payload = decode_token(raw_token)  # signature/expiry only — not the deny-list
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    jti = payload.get("jti")
    if jti:
        exp = payload.get("exp")
        revoke_jti(jti, float(exp) if exp is not None else None)

    revoked = 0
    if body is not None and body.refresh_token:
        revoked = int(revoke_by_raw(db, body.refresh_token))
    elif refresh_cookie is not None:
        require_csrf_for_cookie_flow(refresh_cookie, csrf_cookie, csrf_header)
        revoked = int(revoke_by_raw(db, refresh_cookie))
    else:
        revoked = revoke_all_for_user(db, int(user_id))

    clear_auth_cookies(response)
    return {"ok": True, "revoked_refresh_tokens": revoked}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
