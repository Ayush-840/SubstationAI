from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User, UserRole
from app.core.refresh import (
    CSRF_COOKIE,
    CSRF_HEADER,
    REFRESH_COOKIE,
    find_valid_token,
    issue_refresh_token,
    require_csrf_for_cookie_flow,
    rotate_refresh_token,
    set_auth_cookies,
)
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
)
from app.schemas import UserCreate, UserLogin, UserResponse, Token, RefreshRequest

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


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
