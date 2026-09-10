from __future__ import annotations

import hashlib

from app.infrastructure.hash.common.base import Hash
from app.infrastructure.hash.common.exception import UnsupportedError


class Sha256(Hash):
    def hash(self, *, value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def verify(self, *, hash: str, value: str) -> bool:
        raise UnsupportedError(operation="verify")
