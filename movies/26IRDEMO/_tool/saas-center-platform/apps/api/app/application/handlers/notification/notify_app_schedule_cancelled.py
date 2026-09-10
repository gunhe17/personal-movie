from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    dispatch_single_notification,
    notify_guardians,
    notify_single_member,
)


async def notify_app_schedule_cancelled_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    session_id: str,
    case_id: str,
) -> None:
    # load
    case_facade = CounselingCaseFacade(uow)
    case = await case_facade.get_case_by_id(case_id, center_id)
    client_ids = (
        await case_facade.aggregate_active_client_ids_by_case_ids([case_id])
    ).get(case_id, [])

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics: list = []
    guardian_targets = []
    # 내담자 앱 — 가족 전원(취소한 본인 포함)
    for client_id in client_ids:
        guardian_targets.extend(
            await notify_guardians(
                uow=uow,
                center_id=center_id,
                client_id=client_id,
                category="counseling",
                event_type="session_cancelled",
                title="일정이 취소됐어요",
                body="센터와 일정을 다시 확인해 주세요.",
                push_title="일정에 변동이 있어요",
                push_body="앱에서 확인해 주세요.",
                data={"session_id": session_id},
                event_ref_prefix=f"counseling_session:{session_id}:app_cancelled:{client_id}",
                atomics=atomics,
            )
        )

    # 담당자 — 전문가앱 + 센터 콘솔(같은 알림 시스템)
    member_targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="counseling",
        event_type="session_cancelled",
        priority="important",
        title="내담자가 일정을 취소했어요",
        body=f"상담 케이스 {case.case_code}의 회기가 내담자 앱에서 취소되었습니다.",
        data={
            "case_id": case.id,
            "case_code": case.case_code,
            "session_id": session_id,
        },
        event_ref=f"counseling_session:{session_id}:app_cancelled",
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
