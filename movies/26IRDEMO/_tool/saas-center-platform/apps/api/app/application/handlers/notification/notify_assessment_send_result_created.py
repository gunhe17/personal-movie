from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentCaseFacade, AssessmentTaskFacade
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    notify_guardians,
)


async def notify_assessment_send_result_created_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
) -> None:
    # verify — 결과 전송 핸들러가 G3 게이트를 연 케이스만(보호자 열람 가능 보고서 존재)
    tasks = await AssessmentTaskFacade(uow).get_tasks_by_case_id(case_id)
    if not any(task.is_report_visible_to_guardian for task in tasks):
        return

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    client_ids = (
        await AssessmentCaseFacade(uow).aggregate_client_ids_by_case_ids([case_id])
    ).get(case_id, [])

    atomics = []
    targets = []
    for client_id in client_ids:
        targets.extend(
            await notify_guardians(
                uow=uow,
                center_id=center_id,
                client_id=client_id,
                category="assessment",
                event_type="report_shared",
                title="검사 결과지가 도착했어요",
                body="앱에서 결과지를 확인할 수 있어요.",
                push_title="새 소식이 있어요",
                push_body="앱에서 확인해 주세요.",
                data={"case_id": case_id},
                event_ref_prefix=f"assessment_case:{case_id}:report_shared:{client_id}",
                atomics=atomics,
            )
        )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in targets:
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
