from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.worker.factory import get_worker_batch_dispatcher
from app.runtime.voucher_document.constants import JOB_TYPE_VOUCHER_EXTRACT
from app.runtime.voucher_document.executor import process_voucher_extract


async def enqueue_voucher_extraction_handler(
    *,
    extraction_id: str,
    uow: UnitOfWork | None = None,
    center_id: str | None = None,
    event_group_id: str | None = None,
) -> None:
    # 전진은 워커가 자기 수명으로 돈다 — 요청 안에서 돌리면 클라이언트 타임아웃이 작업
    # 수명을 정해 스테이지가 통째로 죽는다(2026-08-31 실측 3회).
    # distributed=batch 큐 / embedded(개발 단일 프로세스)=큐·워커 부재라 즉시 실행.
    # 중복 배달은 executor 의 실행권 선점이 흡수한다.
    dispatcher = get_worker_batch_dispatcher()
    if dispatcher is not None:
        await dispatcher.dispatch(
            JOB_TYPE_VOUCHER_EXTRACT,
            target_id=extraction_id,
            center_id="",
            params={},
        )
        return

    await process_voucher_extract(extraction_id, "")
