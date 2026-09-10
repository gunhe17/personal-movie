from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.worker.factory import get_worker_batch_dispatcher
from app.runtime.ai_lab.executor import process_lab_batch_compare


async def enqueue_lab_batch_compare_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    group_id: str,
    variants: list,
) -> None:
    # outbox 반응 전용 Track B enqueue(eventing §1). distributed=batch 큐 /
    # embedded(개발 단일 프로세스)=큐·워커 부재라 즉시 실행. 중복은 executor status-skip이 흡수(§6).
    dispatcher = get_worker_batch_dispatcher()
    if dispatcher is not None:
        await dispatcher.dispatch(
            "lab_batch_compare",
            target_id=group_id,
            center_id=center_id or "",
            params={"variants": variants},
        )
        return

    await process_lab_batch_compare(group_id, center_id or "", variants=variants)
