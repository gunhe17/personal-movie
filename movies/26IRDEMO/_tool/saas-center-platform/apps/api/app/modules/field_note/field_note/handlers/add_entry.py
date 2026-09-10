from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...field_note_entry.schemas import FieldNoteEntryCreate, FieldNoteEntryResponse
from ..repository import FieldNoteRepository
from ..services import GetFieldNoteService
from ...field_note_entry.repository import FieldNoteEntryRepository
from ...field_note_entry.services import CreateEntryService


async def add_entry_handler(
    field_note_id: str,
    center_id: str,
    data: FieldNoteEntryCreate,
    uow: UnitOfWork,
) -> FieldNoteEntryResponse:
    await GetFieldNoteService(uow.repo(FieldNoteRepository)).execute(
        field_note_id, center_id
    )
    entry = await CreateEntryService(uow.repo(FieldNoteEntryRepository)).execute(
        field_note_id,
        entry_type=data.entry_type,
        content=data.content,
        timestamp_seconds=data.timestamp_seconds,
        tag_category=data.tag_category,
    )
    return FieldNoteEntryResponse.model_validate(entry)


TOOL = {
    "name": "add_entry_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트에 항목(엔트리)을 추가한다.",
    "keywords": ["add entry", "필드노트 항목 추가", "노트 엔트리", "기록 추가"],
    "boundaries": "필드노트에 엔트리 추가. 녹음 종료는 finish_recording_handler.",
    "output": "추가된 필드노트 항목 (FieldNoteEntryResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "엔트리를 추가할 필드노트의 UUID.",
            },
            "entry_type": {
                "description": "엔트리 타입: memo(메모)/tag(태그).",
                "title": "엔트리 타입",
                "type": "string",
            },
            "tag_category": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "태그 카테고리: observation/behavior/emotion/other(선택).",
                "title": "태그 카테고리",
            },
            "content": {
                "description": "엔트리 내용.",
                "minLength": 1,
                "title": "내용",
                "type": "string",
            },
            "timestamp_seconds": {
                "description": "녹음 시작 기준 경과 시간(초).",
                "minimum": 0,
                "title": "경과 시간(초)",
                "type": "number",
            },
        },
        "required": ["field_note_id", "entry_type", "content", "timestamp_seconds"],
    },
}
