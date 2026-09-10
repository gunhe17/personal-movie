from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormResponse


async def submit_instance_handler(
    instance_id: str,
    center_id: str,
    uow: UnitOfWork,
    submitted_by: str | None = None,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> FormResponse:
    facade = FormFacade(uow)
    atomic, response = await facade.submit_instance(
        center_id=center_id,
        instance_id=instance_id,
        submitted_by=submitted_by,
    )
    await emit(
        uow,
        "form_submitted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return response


TOOL = {
    "name": "submit_instance_handler",
    "permission": "write:form_instance",
    "purpose": "폼 인스턴스를 최종 제출한다.",
    "keywords": ['submit instance', "폼 제출", "설문 제출", "submit form", "응답 완료"],
    "boundaries": "폼 '최종 제출'. 저장은 upsert_answers_handler, 되돌리기는 revert_instance_handler.",
    "output": "제출 완료된 폼 (FormResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "instance_id": {"type": "string", "format": "uuid", "title": "대상 폼", "description": "제출할 폼 인스턴스의 UUID."},
        },
        "required": ["instance_id"],
    },
}
