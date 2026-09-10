from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import CounselingNoteFacade


async def delete_note_handler(
    *,
    event_group_id: uuid_str,
    note_id: str,
    center_id: str,
    counselor_id: str | None,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    facade = CounselingNoteFacade(uow)

    atomic, _ = await facade.delete_note_by_id(
        note_id=note_id,
        center_id=center_id,
        counselor_id=counselor_id,
    )
    await emit(
        uow,
        "counseling_note_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": 'delete_note_handler',
    "permission": "write:counseling_note",
    "purpose": '상담 일지를 삭제한다.',
    "keywords": ['delete note', '상담 일지 삭제', '노트 삭제', '상담 기록 제거'],
    "boundaries": '상담 일지 삭제. 작성은 create_note_handler.',
    "output": '없음 (상담 일지 삭제).',
    "input_schema": {
        "type": "object",
        "properties": {
            'note_id': {'type': 'string', 'format': 'uuid', 'title': '대상 일지', 'description': '삭제할 상담 일지의 UUID.'},
        },
        "required": ['note_id'],
    },
}
