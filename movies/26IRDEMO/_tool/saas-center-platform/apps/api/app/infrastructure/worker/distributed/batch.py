"""Batch(여유 작업) 전용 디스패처 — ai:jobs:batch stream 으로 발행.

기존 get_task_dispatcher / DistributedDispatcher 는 realtime stream(ai:jobs)을
하드코딩하므로 재사용하면 비긴급 잡이 realtime 큐에 합류해 HoL 이 생긴다.
비긴급 잡은 이 batch 디스패처로 던진다(별도 stream → 별도 batch worker).

fallback 정책(get_batch_dispatcher, worker.factory):
- distributed + Redis 가용 → ai:jobs:batch 로 XADD.
- distributed + Redis 불가 → dispatch 시 예외(embedded fallback 안 함).
  긴 잡을 API 프로세스 BackgroundTasks 로 돌리면 API 이벤트루프를 점유하므로,
  실패시켜 호출자가 status=failed 로 마킹하게 한다.
- embedded(dev) → EmbeddedDispatcher(API 프로세스 실행) 허용.
"""
from __future__ import annotations

from typing import Any

import redis.asyncio as aioredis

from app.core.logger import get_logger

from app.infrastructure.worker.common.schemas import JobMessage
from app.infrastructure.worker.common.streams import STREAM_KEY_BATCH

logger = get_logger(__name__)


class BatchStreamDispatcher:
    def __init__(self, redis: aioredis.Redis | None):
        self._redis = redis

    async def dispatch(
        self,
        job_type: str,
        *,
        target_id: str,
        center_id: str,
        params: dict[str, Any] | None = None,
    ) -> None:
        # target_id = 잡의 대상 리소스 id. params 에 시크릿 금지.
        if self._redis is None:
            raise RuntimeError(
                "Redis 미가용 — batch 작업 큐 전송 불가 (분산모드)"
            )
        msg = JobMessage(
            job_type=job_type,
            target_id=target_id,
            center_id=center_id,
            params=params or {},
        )
        await self._redis.xadd(STREAM_KEY_BATCH, msg.to_redis())
        logger.info(
            "batch job dispatched: stream=%s job_type=%s job_id=%s resource=%s",
            STREAM_KEY_BATCH, job_type, msg.job_id, target_id[:8],
        )
