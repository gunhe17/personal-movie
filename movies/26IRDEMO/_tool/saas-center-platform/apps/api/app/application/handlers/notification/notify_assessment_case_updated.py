from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_assessment_case_updated_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    case_code: str,
    counselor_id: str,
) -> None:
    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=counselor_id,
        category="assessment",
        event_type="case_updated",
        priority="normal",
        title="검사 케이스가 수정되었습니다",
        body=f"검사 케이스 {case_code}가 수정되었습니다.",
        data={"case_id": case_id, "case_code": case_code},
        event_ref=f"assessment_case:{case_id}:updated",
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
