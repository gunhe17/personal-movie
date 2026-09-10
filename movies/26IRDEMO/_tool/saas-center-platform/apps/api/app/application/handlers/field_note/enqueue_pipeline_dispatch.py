from typing import Any

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.worker.factory import get_worker_batch_dispatcher
from app.application.jobs.routes import JOB_HANDLERS


async def enqueue_pipeline_dispatch_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    field_note_id: str,
    job_type: str,
    params: dict[str, Any],
) -> None:
    # 요청 핸들러의 직접 dispatch(eventing §1 금지) → outbox 반응에서 Track B enqueue.
    # distributed=batch 큐 / embedded(개발 단일 프로세스)=큐·워커 부재라 즉시 실행(§6 status-skip).
    dispatcher = get_worker_batch_dispatcher()
    if dispatcher is not None:
        await dispatcher.dispatch(
            job_type,
            target_id=field_note_id,
            center_id=center_id or "",
            params=params or {},
        )
        return

    await JOB_HANDLERS[job_type](field_note_id, center_id or "", **(params or {}))
