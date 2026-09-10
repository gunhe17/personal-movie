from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_counseling_case_updated_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    case_code: str,
    counselor_id: str,
    changed: dict,
) -> None:
    rescheduled = "reschedule_settings" in (changed or {})
    event_type = "case_rescheduled" if rescheduled else "case_updated"
    body_suffix = (
        " 회기 일정이 재설정되었습니다." if rescheduled else " 정보가 수정되었습니다."
    )

    # notify — event_ref가 재시도 간 안정 키라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=counselor_id,
        category="counseling",
        event_type=event_type,
        priority="important",
        title="상담 케이스가 수정되었습니다",
        body=f"상담 케이스 {case_code}{body_suffix}",
        data={"case_id": case_id, "case_code": case_code},
        event_ref=f"counseling_case:{case_id}:{event_type}",
        atomics=atomics,
    )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(event_ref가 send-key)
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
