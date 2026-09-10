from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.worker.factory import get_worker_batch_dispatcher
from app.runtime.form_template.constants import JOB_TYPE_FORM_EXTRACT
from app.runtime.form_template.executor import process_form_extract


async def enqueue_form_extraction_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    extraction_id: str,
) -> None:
    # outbox 반응 전용 Track B enqueue(eventing §1). distributed=batch 큐 /
    # embedded(개발 단일 프로세스)=큐·워커 부재라 즉시 실행. 중복은 executor status-skip이 흡수(§6).
    dispatcher = get_worker_batch_dispatcher()
    if dispatcher is not None:
        await dispatcher.dispatch(
            JOB_TYPE_FORM_EXTRACT,
            target_id=extraction_id,
            center_id=center_id or "",
            params={},
        )
        return

    await process_form_extract(extraction_id, center_id or "")
