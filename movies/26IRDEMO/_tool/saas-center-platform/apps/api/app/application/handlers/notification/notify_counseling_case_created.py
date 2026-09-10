from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    dispatch_single_notification,
    notify_guardians,
    notify_single_member,
)


async def notify_counseling_case_created_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
) -> None:
    # load
    case_facade = CounselingCaseFacade(uow)
    case = await case_facade.get_case_by_id(case_id, center_id)
    client_ids = (
        await case_facade.aggregate_active_client_ids_by_case_ids([case_id])
    ).get(case_id, [])

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="counseling",
        event_type="case_created",
        priority="important",
        title="상담 접수가 확정되었습니다",
        body=f"상담 케이스 {case.case_code} ({case.total_sessions}회기)가 접수되었습니다.",
        data={"case_id": case.id, "case_code": case.case_code},
        event_ref=f"counseling_case:{case.id}:created",
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
                category="counseling",
                event_type="case_created",
                title="상담이 접수됐어요",
                body=f"총 {case.total_sessions}회기 상담이 접수되었습니다. 일정을 앱에서 확인해 주세요.",
                push_title="새 소식이 있어요",
                push_body="앱에서 확인해 주세요.",
                data={
                    "case_id": case.id,
                    "navigate_to": f"/counseling-case/{case.id}",
                },
                event_ref_prefix=f"counseling_case:{case.id}:created:{client_id}",
                atomics=atomics,
            )
        )

    # dispatch — session payload N개 fan-out + 회기추가 플로우(schedule_created 동명 그룹) 재트리거가
    # 있어, 인앱 행이 새로 생긴 호출만 발송(notification_id 없음 = event_ref 중복 skip)
    # = 반응 재시도 시 외부 중복 발송 방지(in-app event_ref가 send-key 역할).
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
