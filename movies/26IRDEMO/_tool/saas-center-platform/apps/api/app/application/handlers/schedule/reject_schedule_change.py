from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.schedule.facade import ScheduleChangeRequestFacade
from app.modules.schedule.schedule_change_request.schemas import ScheduleChangeRequestResponse


async def reject_schedule_change_handler(
    *,
    center_id: str,
    request_id: str,
    reason: str,
    actor_member_id: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> ScheduleChangeRequestResponse:
    # decide
    atomic, rejected = await ScheduleChangeRequestFacade(uow).decide_change_request(
        request_id=request_id,
        center_id=center_id,
        status="rejected",
        decided_by_member_id=actor_member_id,
        decision_note=reason,
    )
    await emit(
        uow,
        "schedule_change_request_rejected",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
    )

    # return
    return ScheduleChangeRequestResponse.model_validate(rejected)
