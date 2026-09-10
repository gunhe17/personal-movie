from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import FieldNoteResponse
from ..repository import FieldNoteRepository
from ..services import LinkScheduleService


async def link_schedule_handler(
    field_note_id: str,
    center_id: str,
    schedule_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> FieldNoteResponse:
    field_note_atomic, field_note = await LinkScheduleService(
        uow.repo(FieldNoteRepository)
    ).execute(
        field_note_id,
        center_id,
        schedule_id=schedule_id,
    )
    await emit(
        uow,
        "field_note_updated",
        event_group_id=event_group_id,
        atomics=[field_note_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return FieldNoteResponse.model_validate(field_note)


TOOL = {
    "name": "link_schedule_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트를 일정에 연결한다.",
    "keywords": ["일정 연결", "스케줄 연결", "필드노트 링크", "link schedule"],
    "boundaries": "필드노트를 일정에 '연결'. 작업 연결은 application/handlers의 link_task.",
    "output": "일정에 연결된 필드노트 (FieldNoteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "연결할 필드노트의 UUID.",
            },
            "schedule_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 일정",
                "description": "연결 대상 일정의 UUID.",
            },
        },
        "required": ["field_note_id", "schedule_id"],
    },
}
