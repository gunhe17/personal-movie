from __future__ import annotations

from fastapi import BackgroundTasks

from app.core.config import settings

from app.infrastructure.worker.common.base import TaskDispatcher
from app.infrastructure.worker.common.exception import WorkerDispatchError
from app.infrastructure.worker.embedded.client import EmbeddedDispatcher


async def get_task_dispatcher(
    background_tasks: BackgroundTasks,
) -> TaskDispatcher:
    if settings.AI_WORKER_MODE == "distributed":
        from app.infrastructure.cache.factory import get_redis_transport
        from app.infrastructure.worker.distributed.client import DistributedDispatcher

        transport = get_redis_transport()
        if transport is None:
            # distributed 모드에서 Redis 부재 = 구성 오류. 조용한 embedded 강등 금지(§6 fallback 금지)
            raise WorkerDispatchError("AI_WORKER_MODE=distributed but Redis unavailable")
        return DistributedDispatcher(transport)

    return EmbeddedDispatcher(background_tasks)


async def get_batch_dispatcher(
    background_tasks: BackgroundTasks,
) -> TaskDispatcher:
    """batch 전용 디스패처 주입. 기존 get_task_dispatcher(realtime) 재사용 금지."""
    if settings.AI_WORKER_MODE == "distributed":
        from app.infrastructure.cache.factory import get_redis_transport
        from app.infrastructure.worker.distributed.batch import BatchStreamDispatcher

        return BatchStreamDispatcher(get_redis_transport())

    return EmbeddedDispatcher(background_tasks)


def get_worker_batch_dispatcher() -> TaskDispatcher | None:
    """워커(반응) 문맥 전용 — BackgroundTasks 없이 batch 큐 디스패처. embedded면 None(호출자가 즉시 실행)."""
    if settings.AI_WORKER_MODE == "distributed":
        from app.infrastructure.cache.factory import get_redis_transport
        from app.infrastructure.worker.distributed.batch import BatchStreamDispatcher

        return BatchStreamDispatcher(get_redis_transport())
    return None
