from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)
from app.modules.schedule.facade import ScheduleFacade


async def notify_schedule_change_request_approved_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    request_id: str,
    schedule_id: str,
    decided_by_member_id: str | None,
) -> None:
    # load
    schedule = await ScheduleFacade(uow).get_schedule(
        schedule_id=schedule_id,
        center_id=center_id,
    )
    if not schedule.member_id or schedule.member_id == decided_by_member_id:
        return

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics: list = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=schedule.member_id,
        category="counseling",
        event_type="schedule_changed",
        title="담당 일정이 변경됐어요",
        body="내담자의 변경 요청이 승인됐어요.",
        data={"schedule_id": schedule_id, "request_id": request_id},
        event_ref=f"schedule_change_request:{request_id}:approved",
        atomics=atomics,
    )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in targets:
        if target.notification_id:
            await dispatch_single_notification(target)
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
