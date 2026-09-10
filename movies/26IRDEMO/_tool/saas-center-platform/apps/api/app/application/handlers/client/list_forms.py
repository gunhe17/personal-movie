from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormSummary
from app.modules.client.facade.resource_facade import ResourceFacade
from app.application.schemas import (
    ClientFormInstanceItem,
    ClientFormInstanceListResponse,
)
from app.infrastructure.persistence.new_repository import single_page


async def list_forms_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    template_id: str | None = None,
    status: str | None = None,
) -> ClientFormInstanceListResponse:
    resource_facade = ResourceFacade(uow)
    mappings = await resource_facade.list_forms_by_client(
        center_id=center_id,
        client_id=client_id,
    )

    if not mappings:
        return ClientFormInstanceListResponse(items=[], **single_page([]))

    instance_ids = [m.resource_id for m in mappings]
    form_facade = FormFacade(uow)
    instances = await form_facade.get_instances_by_ids(instance_ids, center_id)

    instance_map = {inst.id: inst for inst in instances}

    items = []
    for mapping in mappings:
        instance = instance_map.get(mapping.resource_id)
        if not instance:
            continue

        if template_id and instance.template_id != template_id:
            continue
        if status and instance.status != status:
            continue

        items.append(
            ClientFormInstanceItem(
                mapping_id=mapping.id,
                instance=FormSummary.model_validate(instance),
                created_at=mapping.created_at,
            )
        )

    return ClientFormInstanceListResponse(
        items=items,
        **single_page(items),
    )


TOOL = {
    "name": "list_forms_handler",
    "permission": "read:form_instance",
    "purpose": "내담자에게 발급된 폼(설문) 목록을 조회한다.",
    "keywords": [
        "list forms",
        "내담자 폼 목록",
        "설문 목록",
        "발급 폼 조회",
        "양식 목록",
        "client forms",
    ],
    "boundaries": "한 내담자의 폼 인스턴스 목록(읽기 전용). 폼 발급은 link_form_instance_handler.",
    "output": "발급된 폼 목록 (ClientFormInstanceListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "폼을 조회할 내담자의 UUID.",
            },
            "template_id": {
                "type": "string",
                "format": "uuid",
                "title": "폼 템플릿 필터",
                "description": "특정 템플릿으로 거를 UUID(선택).",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
            },
        },
        "required": ["client_id"],
    },
}
