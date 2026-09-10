from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade.assessment_session_facade import AssessmentSessionFacade
from app.modules.counseling.facade.counseling_session_facade import CounselingSessionFacade
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_guardian_notification,
    dispatch_single_notification,
    notify_guardians,
    notify_single_member,
)


async def notify_schedule_deleted_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    schedule_id: str,
) -> None:
    # resolve — 일정은 soft-delete됐지만 세션은 schedule_id 컬럼으로 남아 참여자 역산 가능
    pairs: list[tuple[str, str]] = []
    counselors: list[tuple[str, str, str | None]] = []
    for category, facade in (
        ("counseling", CounselingSessionFacade(uow)),
        ("assessment", AssessmentSessionFacade(uow)),
    ):
        for session in await facade.get_sessions_by_schedule_ids([schedule_id]):
            for participant in session.client_participants:
                client_id = participant.get("participant_id")
                if client_id and (category, client_id) not in pairs:
                    pairs.append((category, client_id))
            entry = (category, session.counselor_id, session.case_code)
            if session.counselor_id and entry not in counselors:
                counselors.append(entry)

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics: list = []
    targets = []
    member_targets = []
    for category, counselor_id, case_code in counselors:
        member_targets.extend(
            await notify_single_member(
                uow=uow,
                center_id=center_id,
                member_id=counselor_id,
                category=category,
                event_type="schedule_cancelled",
                priority="important",
                title="담당 일정이 삭제되었습니다",
                body=f"{case_code or '일정'} 일정이 삭제되었습니다.",
                data={"schedule_id": schedule_id, "case_code": case_code},
                event_ref=f"schedule:{schedule_id}:cancelled:member:{counselor_id}",
                atomics=atomics,
            )
        )

    for category, client_id in pairs:
        targets.extend(
            await notify_guardians(
                uow=uow,
                center_id=center_id,
                client_id=client_id,
                category=category,
                event_type="schedule_cancelled",
                title="일정이 취소됐어요",
                body="센터와 일정을 다시 확인해 주세요.",
                push_title="일정에 변동이 있어요",
                push_body="앱에서 확인해 주세요.",
                data={"schedule_id": schedule_id},
                event_ref_prefix=f"schedule:{schedule_id}:cancelled:{client_id}",
                atomics=atomics,
            )
        )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for member_target in member_targets:
        if member_target.notification_id:
            await dispatch_single_notification(member_target)
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
