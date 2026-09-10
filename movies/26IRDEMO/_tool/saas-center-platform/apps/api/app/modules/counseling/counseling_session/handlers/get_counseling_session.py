from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CounselingSessionResponse
from ...facade import CounselingSessionFacade


async def get_counseling_session_handler(
    session_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
) -> CounselingSessionResponse:
    facade = CounselingSessionFacade(uow)

    await facade.verify_session_readable(session_id, center_id, owner_scope)

    response = await facade.get_session_with_response(
        session_id=session_id,
        center_id=center_id,
        counselor_id=None,
    )

    return response


TOOL = {
    "name": "get_counseling_session_handler",
    "permission": "read:counseling",
    "purpose": "상담 회기 한 건을 조회한다.",
    "keywords": ["회기 조회", "상담 회기 상세", "session 조회"],
    "boundaries": "단건 회기 조회(읽기). 목록은 list_counseling_sessions_handler.",
    "output": "상담 회기 상세 (CounselingSessionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "조회할 상담 회기의 UUID.",
            },
        },
        "required": ["session_id"],
    },
}
