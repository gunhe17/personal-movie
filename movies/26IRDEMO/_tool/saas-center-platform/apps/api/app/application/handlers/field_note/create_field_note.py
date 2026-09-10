from app.core.type import uuid_str
from app.core.exceptions import InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentTaskFacade
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.field_note.field_note.schemas import FieldNoteResponse


async def create_field_note_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    author_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
    schedule_id: str | None = None,
    task_id: str | None = None,
) -> FieldNoteResponse:
    if task_id:
        task = await AssessmentTaskFacade(uow).get_task(task_id, center_id)
        if task.execution_method == "online":
            raise InvalidOperationException(
                "온라인 검사에는 필드노트를 연결할 수 없습니다."
            )

    atomic, field_note = await FieldNoteFacade(uow).create_field_note(
        center_id=center_id,
        author_id=author_id,
        schedule_id=schedule_id,
        task_id=task_id,
    )
    await emit(
        uow,
        "field_note_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return FieldNoteResponse.model_validate(field_note)


TOOL = {
    "name": "create_field_note_handler",
    "permission": "write:counseling_note",
    "purpose": "녹음·일정 기반의 새 필드노트를 생성한다.",
    "keywords": [
        "create field note",
        "필드노트 생성",
        "노트 만들기",
        "녹음 노트 추가",
        "회기 노트 생성",
        "field note 생성",
    ],
    "boundaries": "새 필드노트를 '생성'한다(일정/작업 연결 가능). 조회는 get_field_note_detail_handler, 목록은 list_field_notes_with_brief_handler.",
    "output": "생성된 필드노트 (FieldNoteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_id": {
                "type": "string",
                "format": "uuid",
                "title": "연결 일정",
                "description": "연결할 일정의 UUID(선택).",
            },
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "연결 작업",
                "description": "연결할 검사 작업의 UUID(선택).",
            },
        },
        "required": [],
    },
}
