from datetime import datetime, timedelta, timezone
from uuid import uuid4
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import User, UserRole
from app.core.config import get_settings
from app.core.denylist import is_revoked

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Current hasher: argon2id at the OWASP minimum (m=19 MiB, t=2, p=1).
# bcrypt rows stay verifiable via pwd_context until transparently re-hashed
# on the account's next successful login (AUTH_TRD Day 2, A-10).
_argon2 = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
# Logout must still work with an expired access token (so a user whose token
# lapsed can end the session and revoke the refresh token).
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify against argon2id (current) or bcrypt (legacy) hashes.

    Any malformed/unknown hash returns False instead of raising, so a corrupt
    row can never 500 a login attempt.
    """
    if not hashed_password:
        return False
    if hashed_password.startswith("$argon2"):
        try:
            return bool(_argon2.verify(hashed_password, plain_password))
        except (VerificationError, ValueError):
            return False
    try:
        return bool(pwd_context.verify(plain_password, hashed_password))
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    return _argon2.hash(password)


def password_hash_needs_upgrade(hashed_password: str) -> bool:
    """True for legacy (bcrypt) rows that should be re-hashed on next login."""
    return not hashed_password.startswith("$argon2id$")


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": now, "typ": "access"})
    # jti identifies this issuance so /auth/logout can deny-list exactly this
    # token; setdefault lets callers supply their own id.
    to_encode.setdefault("jti", uuid4().hex)
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, verify_exp: bool = True) -> dict:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": verify_exp},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    payload = decode_token(token)
    if payload.get("typ", "access") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    jti = payload.get("jti")
    if jti and await is_revoked(jti):
        raise HTTPException(
            status_code=401,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_role(*allowed: UserRole):
    """Dependency factory: only the listed roles may call the endpoint (Day 7 B).

    Usage::

        @router.post("/diagnosis")
        async def diagnosis(
            current_user: User = Depends(
                require_role(UserRole.ENGINEER, UserRole.ADMIN)
            ),
        ): ...
    """

    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            roles = " or ".join(r.value for r in allowed)
            raise HTTPException(status_code=403, detail=f"{roles} role required")
        return current_user

    return checker
