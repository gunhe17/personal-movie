from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import FieldNoteRepository
from ..services import DeleteFieldNoteService


async def delete_field_note_handler(
    *,
    event_group_id: uuid_str,
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    field_note_atomic, _ = await DeleteFieldNoteService(
        uow.repo(FieldNoteRepository)
    ).execute(field_note_id, center_id)
    await emit(
        uow,
        "field_note_deleted",
        event_group_id=event_group_id,
        atomics=[field_note_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_field_note_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트를 삭제한다.",
    "keywords": ["delete field note", "필드노트 삭제", "노트 삭제", "field note 삭제"],
    "boundaries": "필드노트 삭제.",
    "output": "없음 (필드노트 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "삭제할 필드노트의 UUID.",
            },
        },
        "required": ["field_note_id"],
    },
}
