from __future__ import annotations


class NoopCacheClient:
    async def get(self, key: str) -> str | None:
        return None

    async def set(self, key: str, value: str, *, ex: int | None = None) -> None:
        pass

    async def set_nx(self, key: str, *, ex: int | None = None) -> bool:
        return True  # cache 부재 = 게이트 없음(fail-open): send-key는 최적화라 미차단이 안전 기본값

    async def delete(self, key: str) -> None:
        pass

    async def exists(self, key: str) -> bool:
        return False

    async def publish(self, channel: str, message: str) -> None:
        pass

    async def lpush(self, key: str, *values: str) -> None:
        pass

    async def brpop(self, key: str, timeout: int = 0) -> tuple[str, str] | None:
        return None

    async def ping(self) -> bool:
        return False

    async def close(self) -> None:
        pass
