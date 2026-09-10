from __future__ import annotations

from functools import lru_cache

from app.infrastructure.hash.bcrypt.client import Bcrypt
from app.infrastructure.hash.common.base import Hash
from app.infrastructure.hash.sha256.client import Sha256


@lru_cache
def get_password_hasher() -> Hash:
    return Bcrypt()


@lru_cache
def get_token_hasher() -> Hash:
    return Sha256()
