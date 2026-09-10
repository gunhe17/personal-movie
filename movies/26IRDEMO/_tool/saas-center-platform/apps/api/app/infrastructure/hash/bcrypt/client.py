from __future__ import annotations

from passlib.context import CryptContext

from app.infrastructure.hash.common.base import Hash

# bcrypt strict — 저장값이 bcrypt 해시가 아니면 passlib가 예외(평문 fallback 없음)
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Bcrypt(Hash):
    def hash(self, *, value: str) -> str:
        return _pwd_context.hash(value)

    def verify(self, *, hash: str, value: str) -> bool:
        return _pwd_context.verify(value, hash)
