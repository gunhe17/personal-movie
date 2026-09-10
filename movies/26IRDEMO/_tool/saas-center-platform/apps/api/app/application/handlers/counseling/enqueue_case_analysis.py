from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.worker.factory import get_worker_batch_dispatcher
from app.runtime.case_analysis.constants import JOB_TYPE_CASE_ANALYSIS
from app.runtime.case_analysis.executor import process_case_analysis


async def enqueue_case_analysis_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    analysis_id: str,
    member_id: str | None,
    session_take: int | None = None,
) -> None:
    # 무거운 LLM은 Track A 반응에서 직접 실행 금지(eventing §1) — batch 큐로 enqueue.
    # distributed=batch 큐 / embedded(개발 단일 프로세스)=큐·워커 부재라 즉시 실행(§6 status-skip).
    dispatcher = get_worker_batch_dispatcher()
    if dispatcher is not None:
        await dispatcher.dispatch(
            JOB_TYPE_CASE_ANALYSIS,
            target_id=analysis_id,
            center_id=center_id or "",
            params={"member_id": member_id, "session_take": session_take},
        )
        return

    await process_case_analysis(
        analysis_id, center_id or "", member_id=member_id, session_take=session_take
    )
