from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentCaseFacade
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_assessment_session_reverted_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    session_id: str,
    case_id: str,
    reverted_at: str,
) -> None:
    # load
    case = await AssessmentCaseFacade(uow).get_case_by_id(center_id, case_id)

    # notify — reverted_at(회기 updated_at)을 event_ref에 넣어 재시도엔 안정(중복 skip),
    # 재-취소 후 다시 되돌리면 새 값이라 새 알림(되돌리기는 반복 가능한 동작)
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="assessment",
        event_type="session_reverted",
        priority="important",
        title="검사 회기 취소가 되돌려졌습니다",
        body=f"검사 케이스 {case.case_code}의 회기가 예정 상태로 복구되었습니다.",
        data={
            "case_id": case.id,
            "case_code": case.case_code,
            "session_id": session_id,
        },
        event_ref=f"assessment_session:{session_id}:reverted:{reverted_at}",
        atomics=atomics,
    )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(notification_id 없음 = event_ref 중복 skip)
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
