"""인증 및 보안 유틸리티"""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

TOKEN_VERSION = 1

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    data: dict[str, Any],
    account_token_version: int = 0,
    expires_delta: timedelta | None = None,
) -> str:
    """JWT Access Token 생성"""
    to_encode = data.copy()
    to_encode["token_version"] = TOKEN_VERSION
    to_encode["account_token_version"] = account_token_version

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    """JWT Access Token 디코드"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None


def hash_refresh_token(token: str) -> str:
    """Refresh Token 해시 (SHA-256)"""
    return hashlib.sha256(token.encode()).hexdigest()
