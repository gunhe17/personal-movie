from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentCaseFacade
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    dispatch_single_notification,
    notify_guardians,
    notify_single_member,
)


async def notify_assessment_case_created_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    case_code: str,
    counselor_id: str,
) -> None:
    # load
    client_ids = (
        await AssessmentCaseFacade(uow).aggregate_client_ids_by_case_ids([case_id])
    ).get(case_id, [])

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=counselor_id,
        category="assessment",
        event_type="case_created",
        priority="important",
        title="검사 접수가 확정되었습니다",
        body=f"검사 케이스 {case_code}가 접수되었습니다.",
        data={"case_id": case_id, "case_code": case_code},
        event_ref=f"assessment_case:{case_id}:created",
        atomics=atomics,
    )

    # 내담자 앱 — 연결된 가족 전원. 잠금화면 문구는 아이 이름·센터 성격을 빼고(NTF-01)
    guardian_targets = []
    for client_id in client_ids:
        guardian_targets.extend(
            await notify_guardians(
                uow=uow,
                center_id=center_id,
                client_id=client_id,
                category="assessment",
                event_type="case_created",
                title="검사가 접수됐어요",
                body="심리검사가 접수되었습니다. 일정을 앱에서 확인해 주세요.",
                push_title="새 소식이 있어요",
                push_body="앱에서 확인해 주세요.",
                data={
                    "case_id": case_id,
                    "navigate_to": f"/assessment-case/{case_id}",
                },
                event_ref_prefix=f"assessment_case:{case_id}:created:{client_id}",
                atomics=atomics,
            )
        )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in targets:
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
