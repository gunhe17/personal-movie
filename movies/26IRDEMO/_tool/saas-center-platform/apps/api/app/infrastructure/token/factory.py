from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.infrastructure.token.common.base import Token
from app.infrastructure.token.jwt.client import Jwt


@lru_cache
def get_token() -> Token:
    return Jwt(
        secret_key=settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
        access_expire_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )
