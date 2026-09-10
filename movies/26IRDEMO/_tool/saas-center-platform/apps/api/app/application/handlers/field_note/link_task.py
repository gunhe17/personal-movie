from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentTaskFacade
from app.modules.event import emit
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.field_note.field_note.schemas import FieldNoteResponse


async def link_task_handler(
    field_note_id: str,
    center_id: str,
    task_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> FieldNoteResponse:
    task = await AssessmentTaskFacade(uow).get_task(task_id, center_id)
    if task.execution_method == "online":
        raise InvalidOperationException(
            "온라인 검사에는 필드노트를 연결할 수 없습니다."
        )

    field_note_atomic, field_note = await FieldNoteFacade(uow).link_task(
        field_note_id=field_note_id,
        center_id=center_id,
        task_id=task_id,
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
    "name": "link_task_handler",
    "permission": "write:counseling_note",
    "purpose": "필드노트를 특정 작업(task)에 연결한다.",
    "keywords": [
        "link task",
        "필드노트 연결",
        "작업 연결",
        "노트 task 링크",
        "녹음 작업 연결",
    ],
    "boundaries": "필드노트를 'task'에 연결한다. 연결 가능한 작업 목록은 list_linkable_tasks_handler.",
    "output": "연결된 필드노트 (FieldNoteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "연결할 필드노트의 UUID.",
            },
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 작업",
                "description": "연결 대상 검사 작업(task)의 UUID.",
            },
        },
        "required": ["field_note_id", "task_id"],
    },
}
