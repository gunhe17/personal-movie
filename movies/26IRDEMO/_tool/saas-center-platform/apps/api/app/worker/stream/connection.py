import redis.asyncio as aioredis

from app.core.config import settings


def redis_client() -> aioredis.Redis:
    pool = aioredis.ConnectionPool.from_url(
        settings.REDIS_URL,
        max_connections=10,
        decode_responses=True,
    )
    return aioredis.Redis(connection_pool=pool)
