from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_counseling_session_reverted_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    session_id: str,
    case_id: str,
) -> None:
    # load
    case = await CounselingCaseFacade(uow).get_case_by_id(case_id, center_id)

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="counseling",
        event_type="session_reverted",
        priority="important",
        title="상담 회기 취소가 되돌려졌습니다",
        body=f"상담 케이스 {case.case_code}의 회기가 예정 상태로 복구되었습니다.",
        data={
            "case_id": case.id,
            "case_code": case.case_code,
            "session_id": session_id,
        },
        event_ref=f"counseling_session:{session_id}:reverted",
        atomics=atomics,
    )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(event_ref가 send-key, 재시도 중복 발송 방지)
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
