from datetime import datetime, timezone

from app.core.datetime_utils import KST
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


def _kst_label(iso_utc: str) -> str:
    parsed = datetime.fromisoformat(iso_utc)
    return parsed.replace(tzinfo=timezone.utc).astimezone(KST).strftime("%m월 %d일 %H:%M")


async def notify_schedule_updated_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    schedule_id: str,
    changed: dict,
    start: str,
) -> None:
    # 시간이 바뀐 경우만 — 제목·메모 수정으로 보호자를 깨우지 않는다
    if changed.get("start") is None and changed.get("end") is None:
        return

    # resolve — 세션 client_participants 경유(케이스 경유는 cancelled를 걸러 취소 알림에 못 쓴다)
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
                event_type="schedule_changed",
                priority="important",
                title="담당 일정이 변경되었습니다",
                body=f"{case_code or '일정'} 일정이 {_kst_label(start)}(으)로 변경되었습니다.",
                data={"schedule_id": schedule_id, "case_code": case_code},
                event_ref=f"schedule:{schedule_id}:changed:{start}:member:{counselor_id}",
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
                event_type="schedule_changed",
                title="일정이 변경됐어요",
                body="바뀐 시간을 앱에서 확인해 주세요.",
                push_title="일정에 변동이 있어요",
                push_body="앱에서 확인해 주세요.",
                data={"schedule_id": schedule_id},
                event_ref_prefix=f"schedule:{schedule_id}:changed:{start}:{client_id}",
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
