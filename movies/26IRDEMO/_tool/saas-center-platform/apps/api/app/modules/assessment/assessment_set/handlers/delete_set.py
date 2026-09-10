from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentSetFacade
from app.modules.event import emit


async def delete_set_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    set_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> MessageResponse:
    facade = AssessmentSetFacade(uow)
    atomic, result = await facade.delete_set(center_id, set_id)
    await emit(
        uow,
        "assessment_set_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return MessageResponse.model_validate(result)


TOOL = {
    "name": "delete_set_handler",
    "permission": "delete:assessment_case",
    "purpose": "검사 세트를 삭제한다.",
    "keywords": ['delete set', "세트 삭제", "검사 묶음 삭제", "set 삭제"],
    "boundaries": "검사 세트 삭제. 조회는 get_set_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "set_id": {'type': 'string', 'format': 'uuid', 'title': '대상 세트', 'description': '삭제할 검사 세트의 UUID.'},
        },
        "required": ["set_id"],
    },
}
