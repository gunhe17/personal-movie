from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.counseling.facade import CounselingSessionFacade
from app.modules.schedule.facade import ScheduleFacade


async def delete_session_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
    actor_id: str | None,
) -> None:
    # 회기와 1:1로 연결된 Schedule도 함께 soft-delete 해 캘린더에 고아 일정이 남지 않게 한다.
    # owner_scope: None=전체, member_id=본인만
    session_facade = CounselingSessionFacade(uow)

    atomics, schedule_id = await session_facade.delete_session(
        session_id=session_id,
        center_id=center_id,
        counselor_id=owner_scope,
    )

    schedule_deleted_atomics = []
    if schedule_id:
        schedule_facade = ScheduleFacade(uow)
        schedule_deleted_atomics, _ = await schedule_facade.delete_schedules(
            [schedule_id]
        )

    # emit — 삭제 알림은 반응(notify_counseling_session_deleted)이 워커에서 처리
    await emit(
        uow,
        "counseling_session_deleted",
        event_group_id=event_group_id,
        atomics=[*atomics, *schedule_deleted_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_session_handler",
    "permission": "delete:counseling",
    "purpose": "상담 케이스 안의 회기(세션) 하나를 연결된 일정과 함께 삭제한다.",
    "keywords": [
        "delete session",
        "회기 삭제",
        "세션 삭제",
        "회기 하나 지우기",
        "일정 삭제",
        "예약 취소",
        "회기 제거",
        "스케줄 지우기",
        "단일 회기 삭제",
    ],
    "boundaries": "케이스는 그대로 두고 그 안의 '회기 한 개'만 제거하는 도구로, 회기와 1:1로 묶인 일정도 함께 soft-delete해 캘린더에 고아 일정이 남지 않게 한다. 케이스 전체를 회기까지 통째로 지우려면 delete_case_handler를, 회기를 지우지 않고 취소 처리만 하려면 cancel_session 류 도구를 쓴다.",
    "output": "없음 (회기 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "삭제할 회기(세션)의 UUID. 연결 일정도 함께 삭제된다.",
            },
        },
        "required": ["session_id"],
    },
}
