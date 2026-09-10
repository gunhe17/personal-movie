from __future__ import annotations

from abc import ABC, abstractmethod


class RateLimiter(ABC):
    @abstractmethod
    def check_and_record(self, key: str, limit: int, window_minutes: int = 15) -> None:
        # 초과 시 RateLimitException raise
        ...

    @abstractmethod
    def reset(self, key: str) -> None: ...

    @abstractmethod
    def get_remaining_attempts(
        self, key: str, limit: int, window_minutes: int = 15
    ) -> int: ...
