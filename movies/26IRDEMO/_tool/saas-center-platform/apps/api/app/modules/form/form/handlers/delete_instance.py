from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade


async def delete_instance_handler(
    *,
    event_group_id: uuid_str,
    instance_id: str,
    center_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> None:
    facade = FormFacade(uow)
    atomic = await facade.delete_instance_with_response(
        center_id=center_id,
        instance_id=instance_id,
    )
    await emit(
        uow,
        "form_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "delete_instance_handler",
    "permission": "delete:form_instance",
    "purpose": "폼 인스턴스를 삭제한다.",
    "keywords": ['delete instance', "폼 삭제", "인스턴스 삭제", "설문 삭제"],
    "boundaries": "폼 인스턴스 삭제. 조회는 get_instance_handler.",
    "output": "없음 (폼 인스턴스 삭제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "instance_id": {"type": "string", "format": "uuid", "title": "대상 폼", "description": "삭제할 폼 인스턴스의 UUID."},
        },
        "required": ["instance_id"],
    },
}
