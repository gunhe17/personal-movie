from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    dispatch_single_notification,
    notify_guardians,
    notify_single_member,
)
from app.modules.schedule.facade import ScheduleFacade


async def notify_schedule_change_request_rejected_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    request_id: str,
    schedule_id: str,
    client_id: str,
    decision_note: str,
    decided_by_member_id: str | None,
) -> None:
    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics: list = []
    guardian_targets = await notify_guardians(
        uow=uow,
        center_id=center_id,
        client_id=client_id,
        category="counseling",
        event_type="schedule_change_rejected",
        title="일정 변경이 어려워요",
        body=decision_note,
        push_title="일정 변경 요청 결과",
        push_body="앱에서 확인해 주세요.",
        data={"schedule_id": schedule_id},
        event_ref_prefix=f"schedule_change_request:{request_id}:rejected",
        atomics=atomics,
    )

    member_targets: list = []
    schedule = await ScheduleFacade(uow).get_schedule(
        schedule_id=schedule_id,
        center_id=center_id,
    )
    if schedule.member_id and schedule.member_id != decided_by_member_id:
        member_targets = await notify_single_member(
            uow=uow,
            center_id=center_id,
            member_id=schedule.member_id,
            category="counseling",
            event_type="schedule_change_rejected",
            title="일정 변경 요청이 반려됐어요",
            body=decision_note,
            data={"schedule_id": schedule_id, "request_id": request_id},
            event_ref=f"schedule_change_request:{request_id}:rejected",
            atomics=atomics,
        )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in member_targets:
        if target.notification_id:
            await dispatch_single_notification(target)
    for target in guardian_targets:
        if target.notification_id:
            await dispatch_guardian_notification(target)
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
