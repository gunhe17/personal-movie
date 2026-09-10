from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormSummary
from app.modules.client.facade.resource_facade import ResourceFacade
from app.application.schemas import ClientFormInstanceItem


async def link_form_instance_handler(
    center_id: str,
    client_id: str,
    template_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ClientFormInstanceItem:
    form_facade = FormFacade(uow)
    form_atomic, instance = await form_facade.create_instance(
        center_id=center_id,
        template_id=template_id,
    )

    resource_facade = ResourceFacade(uow)
    mapping_atomic, mapping = await resource_facade.link_form_instance(
        center_id=center_id,
        client_id=client_id,
        instance_id=instance.id,
    )

    await emit(
        uow,
        "form_instance_linked",
        event_group_id=event_group_id,
        atomics=[form_atomic, mapping_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ClientFormInstanceItem(
        mapping_id=mapping.id,
        instance=FormSummary.model_validate(instance),
        created_at=mapping.created_at,
    )


TOOL = {
    "name": "link_form_instance_handler",
    "permission": "write:form_instance",
    "purpose": "폼(설문) 템플릿을 내담자에게 인스턴스로 연결(발급)한다.",
    "keywords": [
        "link form instance",
        "폼 발급",
        "설문 연결",
        "폼 인스턴스 생성",
        "내담자 폼 배정",
        "양식 발급",
        "form 연결",
    ],
    "boundaries": "템플릿을 내담자용 폼 인스턴스로 '발급/연결'한다. 내담자 폼 목록은 list_forms_handler.",
    "output": "발급된 폼 인스턴스 (ClientFormInstanceItem).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "폼을 발급할 내담자의 UUID.",
            },
            "template_id": {
                "type": "string",
                "format": "uuid",
                "title": "폼 템플릿",
                "description": "발급할 폼 템플릿의 UUID.",
            },
        },
        "required": ["client_id", "template_id"],
    },
}
