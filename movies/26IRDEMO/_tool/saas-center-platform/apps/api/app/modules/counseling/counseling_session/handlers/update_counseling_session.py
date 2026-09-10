from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CounselingSessionUpdate, CounselingSessionResponse
from ...facade import CounselingSessionFacade
from app.modules.event import emit


async def update_counseling_session_handler(
    *,
    event_group_id: uuid_str,
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    data: CounselingSessionUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> CounselingSessionResponse:
    facade = CounselingSessionFacade(uow)

    atomics, session = await facade.update_session(
        session_id=session_id,
        center_id=center_id,
        counselor_id=owner_scope,
        changed=data.model_dump(mode="json", exclude_unset=True),
        status=data.status.value if data.status else None,
    )
    response = CounselingSessionResponse.model_validate(session)

    # emit — 상태 변경 알림은 반응(notify_counseling_session_status_changed)이 워커에서 처리
    await emit(
        uow,
        "counseling_session_updated",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    return response


TOOL = {
    "name": "update_counseling_session_handler",
    "fn": "update_counseling_session_handler",
    "permission": "write:counseling",
    "purpose": "상담 회기 정보를 수정한다.",
    "keywords": [
        "update counseling session",
        "회기 수정",
        "상담 회기 변경",
        "session 수정",
    ],
    "boundaries": "회기 수정. 생성은 create_counseling_session_handler.",
    "output": "수정된 상담 회기 (CounselingSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "수정할 상담 회기의 UUID.",
            },
            "status": {
                "anyOf": [{"$ref": "#/$defs/SessionStatus"}, {"type": "null"}],
                "default": None,
                "description": "상태",
            },
        },
        "$defs": {
            "SessionStatus": {
                "enum": ["scheduled", "completed", "no_show", "cancelled"],
                "title": "SessionStatus",
                "type": "string",
            }
        },
        "required": ["session_id"],
    },
}
