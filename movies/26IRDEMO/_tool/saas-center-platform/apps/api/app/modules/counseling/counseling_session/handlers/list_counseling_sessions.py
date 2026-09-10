from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.persistence.new_repository import single_page
from ..schemas import CounselingSessionListResponse, CounselingSessionSummary
from ...facade import CounselingSessionFacade


async def list_counseling_sessions_handler(
    case_id: str,
    center_id: str,
    owner_scope: str | None,
    uow: UnitOfWork,
) -> CounselingSessionListResponse:
    facade = CounselingSessionFacade(uow)

    await facade.verify_case_readable(case_id, center_id, owner_scope)

    sessions = await facade.list_sessions_with_response(
        case_id=case_id,
        center_id=center_id,
        counselor_id=None,
    )

    return CounselingSessionListResponse(
        items=[CounselingSessionSummary.model_validate(s) for s in sessions],
        **single_page(sessions),
    )


TOOL = {
    "name": "list_counseling_sessions_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스의 회기 목록을 조회한다.",
    "keywords": ["회기 목록", "상담 회기 리스트", "session 목록"],
    "boundaries": "케이스 회기 목록(읽기). 단건은 get_counseling_session_handler.",
    "output": "케이스 회기 목록 (CounselingSessionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "회기를 조회할 상담 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
