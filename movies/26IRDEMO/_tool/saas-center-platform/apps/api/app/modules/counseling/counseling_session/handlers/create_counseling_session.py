from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import CounselingSessionCreate, CounselingSessionResponse
from ...facade import CounselingSessionFacade


async def create_counseling_session_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    owner_scope: str | None,
    data: CounselingSessionCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingSessionResponse:
    facade = CounselingSessionFacade(uow)

    atomics, session = await facade.create_session(
        center_id=center_id,
        counselor_id=owner_scope,
        counseling_case_id=data.counseling_case_id,
        schedule_id=data.schedule_id,
    )
    response = CounselingSessionResponse.model_validate(session)

    # emit — 생성 알림은 반응(notify_counseling_session_created)이 워커에서 처리
    await emit(
        uow,
        "counseling_session_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return response


TOOL = {
    "name": "create_counseling_session_handler",
    "fn": "create_counseling_session_handler",
    "permission": "write:counseling",
    "purpose": "상담 회기를 생성한다.",
    "keywords": [
        "create counseling session",
        "회기 생성",
        "상담 일정 생성",
        "session 생성",
    ],
    "boundaries": "상담 회기 생성. 수정은 update_counseling_session_handler.",
    "output": "생성된 상담 회기 (CounselingSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "counseling_case_id": {
                "description": "회기를 생성할 상담 케이스의 UUID.",
                "title": "대상 케이스",
                "type": "string",
            },
            "schedule_id": {
                "description": "연결할 일정(schedule)의 UUID.",
                "title": "연결 일정",
                "type": "string",
            },
            "session_number": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "description": "회기 번호(1부터, 생략 시 NULL).",
                "title": "회기 번호",
            },
        },
        "required": ["counseling_case_id", "schedule_id"],
    },
}
