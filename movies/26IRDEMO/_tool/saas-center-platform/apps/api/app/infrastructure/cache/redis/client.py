from __future__ import annotations

import redis.asyncio as aioredis


class RedisCacheClient:
    def __init__(self, redis: aioredis.Redis):
        self._redis = redis

    async def get(self, key: str) -> str | None:
        return await self._redis.get(key)

    async def set(self, key: str, value: str, *, ex: int | None = None) -> None:
        await self._redis.set(key, value, ex=ex)

    async def set_nx(self, key: str, *, ex: int | None = None) -> bool:
        return bool(await self._redis.set(key, "1", nx=True, ex=ex))

    async def delete(self, key: str) -> None:
        await self._redis.delete(key)

    async def exists(self, key: str) -> bool:
        return bool(await self._redis.exists(key))

    async def publish(self, channel: str, message: str) -> None:
        await self._redis.publish(channel, message)

    async def lpush(self, key: str, *values: str) -> None:
        await self._redis.lpush(key, *values)

    async def brpop(self, key: str, timeout: int = 0) -> tuple[str, str] | None:
        result = await self._redis.brpop(key, timeout=timeout)
        if result:
            return (result[0], result[1])
        return None

    async def ping(self) -> bool:
        try:
            return await self._redis.ping()  # type: ignore[misc]  # redis-py 비동기 스텁이 ping을 bool로 오타입(런타임은 코루틴)
        except Exception:
            return False

    async def close(self) -> None:
        await self._redis.aclose()
