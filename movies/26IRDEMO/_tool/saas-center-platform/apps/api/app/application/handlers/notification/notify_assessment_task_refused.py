from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentCaseFacade
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_single_member,
)


async def notify_assessment_task_refused_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    task_id: str,
    reason: str | None,
) -> None:
    # load
    case = await AssessmentCaseFacade(uow).get_case_by_id(center_id, case_id)

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="assessment",
        event_type="task_refused",
        priority="important",
        title="내담자가 검사를 거부했습니다",
        body=f"검사 케이스 {case.case_code}에서 내담자가 검사를 거부했습니다.",
        data={
            "case_id": case.id,
            "case_code": case.case_code,
            "task_id": task_id,
            "reason": reason,
        },
        event_ref=f"assessment_task:{task_id}:refused",
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
