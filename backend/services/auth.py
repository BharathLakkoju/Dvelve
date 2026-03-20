import os
import secrets
import logging
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

_SECRET_KEY_ENV = os.getenv("SECRET_KEY")
if not _SECRET_KEY_ENV:
    # FIX: Do not fall back to a known, hardcoded secret. Generate a random
    # one at startup and warn loudly. For production, set SECRET_KEY in the
    # environment or a .env file:
    #   python -c "import secrets; print(secrets.token_hex(32))"
    _SECRET_KEY_ENV = secrets.token_hex(32)
    logger.warning(
        "SECRET_KEY environment variable is not set. A temporary key has been "
        "generated for this session — all JWTs will be invalidated on restart. "
        "Set a persistent SECRET_KEY in your .env file for production use."
    )

SECRET_KEY: str = _SECRET_KEY_ENV
ALGORITHM = "HS256"
# FIX: Reduced from 7 days to 60 minutes to limit the window for stolen tokens.
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    # FIX: Use timezone-aware datetime (utcnow() is deprecated since Python 3.12).
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> Optional[dict]:
    # FIX: If the caller supplies an Authorization header the token MUST be valid.
    # Silently falling back to "anonymous" when a token is present-but-invalid
    # would allow a user with an expired token to bypass auth state checks.
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload
