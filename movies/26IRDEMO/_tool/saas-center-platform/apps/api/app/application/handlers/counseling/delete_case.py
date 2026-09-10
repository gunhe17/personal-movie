from app.core.type import uuid_str
from app.modules.counseling.counseling_session.models import CounselingSessionStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.modules.event import emit
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade


async def delete_case_handler(
    *,
    event_group_id: uuid_str,
    case_id: str,
    center_id: str,
    counselor_id: str | None,
    uow: UnitOfWork,
    actor_id: str | None = None,
) -> None:
    # 삭제는 "처음부터 잘못 만든 케이스" 정리용으로만 허용 — 진행 기록(완료/취소/노쇼/출석)이
    # 하나라도 있으면 불가. 모든 회기·참석자가 scheduled 상태인 초기 케이스만 삭제 가능.
    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    case = await case_facade.get_case_by_id(
        case_id=case_id,
        center_id=center_id,
        counselor_id=counselor_id,
    )

    sessions = await session_facade.get_sessions_by_case_ids([case_id])

    started_sessions = [
        s for s in sessions if s.status != CounselingSessionStatus.SCHEDULED
    ]
    if started_sessions:
        completed = sum(
            1 for s in started_sessions if s.status == CounselingSessionStatus.COMPLETED
        )
        cancelled = sum(
            1 for s in started_sessions if s.status == CounselingSessionStatus.CANCELLED
        )
        no_show = sum(
            1 for s in started_sessions if s.status == CounselingSessionStatus.NO_SHOW
        )

        parts = []
        if completed:
            parts.append(f"완료 {completed}건")
        if cancelled:
            parts.append(f"취소 {cancelled}건")
        if no_show:
            parts.append(f"노쇼 {no_show}건")

        raise InvalidOperationException(
            f"진행된 회기가 있어 삭제할 수 없어요. ({', '.join(parts)})\n"
            "진행 기록이 없는 상담만 삭제할 수 있어요."
        )

    if sessions:
        session_ids = [s.id for s in sessions]
        participants = await session_facade.get_participants_by_session_ids(session_ids)
        attended_participants = [
            p for p in participants if p.attendance_status != "scheduled"
        ]
        if attended_participants:
            raise InvalidOperationException(
                "출석 기록이 있는 회기가 있어 삭제할 수 없어요.\n"
                "진행 기록이 없는 상담만 삭제할 수 있어요."
            )

    schedule_deleted_atomics = []
    schedule_ids = [s.schedule_id for s in sessions if s.schedule_id]
    if schedule_ids:
        schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
            schedule_ids
        )

    # 참여자·회기는 CASCADE로 자동 삭제
    case_atomic, _ = await case_facade.delete_case(
        case_id=case_id,
        center_id=center_id,
        counselor_id=counselor_id,
    )

    # emit — 삭제 알림은 반응(notify_counseling_case_deleted)이 워커에서 발송(payload가 케이스 스냅샷)
    await emit(
        uow,
        "counseling_case_deleted",
        event_group_id=event_group_id,
        atomics=[case_atomic, *schedule_deleted_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_case_handler",
    "permission": "delete:counseling",
    "purpose": "잘못 만든 초기 상담 케이스를 회기·일정과 함께 완전히 삭제한다.",
    "keywords": [
        "delete case",
        "케이스 삭제",
        "상담 삭제",
        "잘못 만든 상담 지우기",
        "접수 취소",
        "케이스 제거",
        "상담 폐기",
        "회기 통째 삭제",
        "오접수 정리",
    ],
    "boundaries": "'처음부터 잘못 만든' 케이스를 정리하는 전용 도구로, 진행 기록(완료·취소·노쇼·출석)이 하나라도 있으면 거부한다 — 모든 회기·참여자가 예약(scheduled) 상태인 초기 케이스만 삭제 가능하다. 이미 진행 중인 케이스의 회기 하나만 지우려면 delete_session_handler를, 케이스를 종결/취소 상태로 마감하려면 update_case_handler를 쓴다.",
    "output": "없음 (케이스 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "삭제할 상담 케이스의 UUID(예약 상태 회기만 있는 초기 케이스).",
            },
        },
        "required": ["case_id"],
    },
}
