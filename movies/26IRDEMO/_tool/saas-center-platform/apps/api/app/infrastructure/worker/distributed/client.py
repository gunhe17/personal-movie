from typing import Any

import redis.asyncio as aioredis

from app.core.logger import get_logger

from app.infrastructure.worker.common.exception import WorkerDispatchError
from app.infrastructure.worker.common.schemas import JobMessage

logger = get_logger(__name__)

STREAM_KEY = "ai:jobs"


class DistributedDispatcher:
    def __init__(
        self,
        redis: aioredis.Redis,
    ):
        self._redis = redis

    async def dispatch(
        self,
        job_type: str,
        *,
        target_id: str,
        center_id: str,
        params: dict[str, Any] | None = None,
    ) -> None:
        msg = JobMessage(
            job_type=job_type,
            target_id=target_id,
            center_id=center_id,
            params=params or {},
        )
        try:
            await self._redis.xadd(STREAM_KEY, msg.to_redis())
            logger.info(
                "Job dispatched to Redis Stream: job_id=%s type=%s field_note=%s",
                msg.job_id, job_type, target_id[:8],
            )
        except Exception as e:
            logger.error("Redis XADD failed: %s", e)
            raise WorkerDispatchError(f"Job dispatch failed: {job_type}") from e
