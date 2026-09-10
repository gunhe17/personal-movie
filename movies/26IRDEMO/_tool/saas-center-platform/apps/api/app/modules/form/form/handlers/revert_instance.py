from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormResponse


async def revert_instance_handler(
    instance_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> FormResponse:
    facade = FormFacade(uow)
    atomic, instance = await facade.revert_instance(
        center_id=center_id,
        instance_id=instance_id,
    )
    await emit(
        uow,
        "form_reverted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return FormResponse.model_validate(instance)


TOOL = {
    "name": "revert_instance_handler",
    "permission": "write:form_instance",
    "purpose": "제출한 폼 인스턴스를 작성중 상태로 되돌린다.",
    "keywords": ['revert instance', "폼 되돌리기", "제출 취소", "revert form"],
    "boundaries": "제출된 폼을 '되돌린다'. 제출은 submit_instance_handler.",
    "output": "작성중으로 되돌린 폼 (FormResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "instance_id": {"type": "string", "format": "uuid", "title": "대상 폼", "description": "되돌릴 폼 인스턴스의 UUID."},
        },
        "required": ["instance_id"],
    },
}
