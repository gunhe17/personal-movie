from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import FieldNoteResponse
from ..repository import FieldNoteRepository
from ..services import ListUnlinkedService


async def list_unlinked_handler(
    center_id: str,
    author_id: str | None,
    uow: UnitOfWork,
    analysis_state: str | None = None,
) -> list[FieldNoteResponse]:
    field_notes = await ListUnlinkedService(uow.repo(FieldNoteRepository)).execute(
        center_id,
        author_id=author_id,
        analysis_state=analysis_state,
    )
    return [FieldNoteResponse.model_validate(fn) for fn in field_notes]


TOOL = {
    "name": "list_unlinked_handler",
    "permission": "read:counseling_note",
    "purpose": "아직 일정/작업에 연결되지 않은 필드노트를 조회한다.",
    "keywords": ["미연결 필드노트", "연결 안된 노트", "unlinked 목록"],
    "boundaries": "미연결 필드노트 목록(읽기). 연결은 link_schedule_handler.",
    "output": "미연결 필드노트 목록 (FieldNoteResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "author_id": {
                "type": "string",
                "format": "uuid",
                "title": "작성자 필터",
                "description": "특정 작성자로 한정(선택).",
            },
            "analysis_state": {
                "type": "string",
                "title": "분석 상태 필터",
                "description": "분석 상태 필터(선택).",
            },
        },
        "required": [],
    },
}
