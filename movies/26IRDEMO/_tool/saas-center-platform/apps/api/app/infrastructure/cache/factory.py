from __future__ import annotations

from app.infrastructure.cache.common.base import CacheClient
from app.infrastructure.cache.noop.client import NoopCacheClient
from app.infrastructure.cache.redis.manager import redis_manager


async def get_cache_client() -> CacheClient:
    client = await redis_manager.init()
    return client or NoopCacheClient()


def get_redis_transport():
    """Redis raw transport (stream XADD 등 CacheClient 계약 밖 소비용). 미가용이면 None."""
    client = redis_manager.client
    return client._redis if client else None
