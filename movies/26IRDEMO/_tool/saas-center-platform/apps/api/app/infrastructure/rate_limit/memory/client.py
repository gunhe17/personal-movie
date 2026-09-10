from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from app.core.datetime_utils import utc_now
from app.core.exceptions import RateLimitException
from app.infrastructure.rate_limit.common.base import RateLimiter


class InMemoryRateLimiter(RateLimiter):
    # 단일 프로세스 메모리 카운터. 다중 replica/영속이 필요하면 redis 구현으로 교체.
    def __init__(self) -> None:
        self.attempts: dict[str, list[datetime]] = defaultdict(list)

    def check_and_record(self, key: str, limit: int, window_minutes: int = 15) -> None:
        now = utc_now()
        cutoff = now - timedelta(minutes=window_minutes)
        self.attempts[key] = [t for t in self.attempts[key] if t > cutoff]
        if len(self.attempts[key]) >= limit:
            raise RateLimitException(
                f"요청이 너무 많습니다. {window_minutes}분 후 다시 시도해 주세요."
            )
        self.attempts[key].append(now)

    def reset(self, key: str) -> None:
        self.attempts.pop(key, None)

    def get_remaining_attempts(
        self, key: str, limit: int, window_minutes: int = 15
    ) -> int:
        cutoff = utc_now() - timedelta(minutes=window_minutes)
        valid = [t for t in self.attempts.get(key, []) if t > cutoff]
        return max(0, limit - len(valid))
