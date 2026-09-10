from __future__ import annotations

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.logger import get_logger
from app.infrastructure.cache.redis.client import RedisCacheClient

logger = get_logger(__name__)


class RedisManager:
    def __init__(self) -> None:
        self._client: RedisCacheClient | None = None

    async def init(self) -> RedisCacheClient | None:
        if not settings.REDIS_ENABLED:
            logger.info("Redis disabled (REDIS_ENABLED=False)")
            return None

        if not settings.REDIS_URL:
            logger.error("REDIS_ENABLED=True but REDIS_URL is empty")
            return None

        try:
            pool = aioredis.ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20,
                decode_responses=True,
            )
            redis = aioredis.Redis(connection_pool=pool)
            await redis.ping()  # type: ignore[misc]  # redis-py 비동기 스텁이 ping을 bool로 오타입(런타임은 코루틴)

            self._client = RedisCacheClient(redis)
            logger.info("Redis connected: %s", settings.REDIS_URL.split("@")[-1])
            return self._client
        except Exception as e:
            logger.error(
                "Redis connection failed (REDIS_ENABLED=True), "
                "falling back to NoopCacheClient: %s", e,
            )
            return None

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None
            logger.info("Redis connection closed")

    @property
    def client(self) -> RedisCacheClient | None:
        return self._client


redis_manager = RedisManager()
