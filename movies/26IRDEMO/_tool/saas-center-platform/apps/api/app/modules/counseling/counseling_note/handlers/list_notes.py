from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CounselingNoteResponse
from ...facade import CounselingNoteFacade


async def list_notes_handler(
    session_id: str,
    center_id: str,
    counselor_id: str | None,
    client_id: str | None,
    viewer_member_id: str,
    uow: UnitOfWork,
) -> list[CounselingNoteResponse]:
    facade = CounselingNoteFacade(uow)

    response = await facade.list_notes_by_session_with_response(
        session_id=session_id,
        center_id=center_id,
        counselor_id=counselor_id,
        client_id=client_id,
        viewer_member_id=viewer_member_id,
    )

    return response


TOOL = {
    "name": "list_notes_handler",
    "permission": "read:counseling_note",
    "purpose": "회기의 상담 일지 목록을 조회한다.",
    "keywords": ["상담 일지 목록", "노트 리스트", "상담 기록 목록"],
    "boundaries": "회기 상담 일지 목록(읽기). 단건은 get_note_handler.",
    "output": "회기 상담 일지 목록 (CounselingNoteResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "session_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 회기",
                "description": "일지를 조회할 상담 회기의 UUID.",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 필터",
                "description": "특정 내담자의 일지만 볼 때(선택).",
            },
        },
        "required": ["session_id"],
    },
}
