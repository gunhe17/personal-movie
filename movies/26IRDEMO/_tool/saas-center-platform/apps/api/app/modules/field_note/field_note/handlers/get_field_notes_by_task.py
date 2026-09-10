from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import FieldNoteStatusItem
from ..repository import FieldNoteRepository


async def get_field_notes_by_task_handler(
    task_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> list[FieldNoteStatusItem]:
    notes = await uow.repo(FieldNoteRepository).list_by_task_in_center(
        task_id=task_id,
        center_id=center_id,
    )
    return [FieldNoteStatusItem.model_validate(n) for n in notes]


TOOL = {
    "name": "get_field_notes_by_task_handler",
    "permission": "read:counseling_note",
    "purpose": "검사 작업에 연결된 필드노트들을 조회한다.",
    "keywords": ["작업 필드노트", "task 노트 조회", "by task"],
    "boundaries": "한 작업(task)에 연결된 필드노트 조회(읽기). 일정 기준은 get_field_note_by_schedule_handler.",
    "output": "작업에 연결된 필드노트 목록 (FieldNoteStatusItem 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 작업",
                "description": "필드노트를 조회할 검사 작업의 UUID.",
            },
        },
        "required": ["task_id"],
    },
}
