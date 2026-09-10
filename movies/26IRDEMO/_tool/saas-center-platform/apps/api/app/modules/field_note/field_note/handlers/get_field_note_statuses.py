from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import FieldNoteStatusItem
from ..repository import FieldNoteRepository
from ..services import GetFieldNoteStatusesService


async def get_field_note_statuses_handler(
    schedule_ids: list[str],
    center_id: str,
    uow: UnitOfWork,
) -> list[FieldNoteStatusItem]:
    field_notes = await GetFieldNoteStatusesService(
        uow.repo(FieldNoteRepository)
    ).execute(schedule_ids, center_id)
    return [FieldNoteStatusItem.model_validate(fn) for fn in field_notes]


TOOL = {
    "name": "get_field_note_statuses_handler",
    "permission": "read:counseling_note",
    "purpose": "여러 일정의 필드노트 상태를 한 번에 조회한다.",
    "keywords": ["필드노트 상태", "노트 진행 상태", "status 조회"],
    "boundaries": "여러 일정의 필드노트 상태 일괄 조회(읽기).",
    "output": "일정별 필드노트 상태 목록 (FieldNoteStatusItem 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "일정 ID 목록",
                "description": "상태를 조회할 일정 UUID 목록.",
            },
        },
        "required": ["schedule_ids"],
    },
}
