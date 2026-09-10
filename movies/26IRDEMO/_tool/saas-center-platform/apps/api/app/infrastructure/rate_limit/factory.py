from __future__ import annotations

from functools import lru_cache

from app.infrastructure.rate_limit.common.base import RateLimiter
from app.infrastructure.rate_limit.memory.client import InMemoryRateLimiter


@lru_cache
def get_rate_limiter() -> RateLimiter:
    return InMemoryRateLimiter()
