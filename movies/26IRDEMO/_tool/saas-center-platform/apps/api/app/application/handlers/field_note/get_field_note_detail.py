from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.field_note.field_note.schemas import (
    FieldNoteDetailResponse,
    TokenUsageItem,
)
from app.modules.llm.facade import LlmCallFacade


async def get_field_note_detail_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> FieldNoteDetailResponse:
    response = await FieldNoteFacade(uow).get_field_note_with_response(
        field_note_id,
        center_id,
    )
    llm_rows = await LlmCallFacade(uow).aggregate_usage_by_source(
        "field_note",
        field_note_id,
    )

    response.token_usage = [TokenUsageItem(**row) for row in llm_rows]
    return response


TOOL = {
    "name": "get_field_note_detail_handler",
    "permission": "read:counseling_note",
    "purpose": "필드노트 한 건의 상세를 조회한다.",
    "keywords": [
        "get field note detail",
        "필드노트 조회",
        "노트 상세",
        "필드노트 상세",
        "녹음 노트 보기",
    ],
    "boundaries": "단건 상세 조회(읽기 전용). 브리프 포함 조회는 get_field_note_with_brief_handler, 목록은 list_field_notes_with_brief_handler.",
    "output": "필드노트 상세 (FieldNoteDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "조회할 필드노트의 UUID.",
            },
        },
        "required": ["field_note_id"],
    },
}
