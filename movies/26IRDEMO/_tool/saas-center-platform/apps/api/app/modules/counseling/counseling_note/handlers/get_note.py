from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CounselingNoteResponse
from ...facade import CounselingNoteFacade


async def get_note_handler(
    note_id: str,
    center_id: str,
    counselor_id: str | None,
    viewer_member_id: str,
    uow: UnitOfWork,
) -> CounselingNoteResponse:
    facade = CounselingNoteFacade(uow)

    response = await facade.get_note_by_id_with_response(
        note_id=note_id,
        center_id=center_id,
        counselor_id=counselor_id,
        viewer_member_id=viewer_member_id,
    )

    return response


TOOL = {
    "name": "get_note_handler",
    "permission": "read:counseling_note",
    "purpose": "상담 일지 한 건을 조회한다.",
    "keywords": ["상담 일지 조회", "노트 상세", "상담 기록 보기"],
    "boundaries": "단건 상담 일지 조회(읽기). 목록은 list_notes_handler.",
    "output": "상담 일지 상세 (CounselingNoteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 일지",
                "description": "조회할 상담 일지의 UUID.",
            },
        },
        "required": ["note_id"],
    },
}
