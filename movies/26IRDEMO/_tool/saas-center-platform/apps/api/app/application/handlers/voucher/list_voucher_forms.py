from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormSummary
from app.modules.voucher.facade.client_voucher_resource_facade import (
    ClientVoucherResourceFacade,
)
from app.application.schemas import (
    ClientFormInstanceItem,
    ClientFormInstanceListResponse,
)
from app.infrastructure.persistence.new_repository import single_page


async def list_voucher_forms_handler(
    center_id: str,
    client_voucher_id: str,
    uow: UnitOfWork,
    status: str | None = None,
) -> ClientFormInstanceListResponse:
    voucher_resource_facade = ClientVoucherResourceFacade(uow)
    mappings = await voucher_resource_facade.list_forms_by_voucher(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
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
    "name": "list_voucher_forms_handler",
    "permission": "read:form_instance",
    "purpose": "내담자 바우처에 연결된 폼 목록을 조회한다.",
    "keywords": [
        "list voucher forms",
        "바우처 폼 목록",
        "이용권 설문 목록",
        "바우처 양식 조회",
        "voucher forms",
    ],
    "boundaries": "한 바우처의 폼 목록(읽기 전용). 연결은 link_voucher_form_instance_handler.",
    "output": "바우처에 연결된 폼 목록 (ClientFormInstanceListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자 바우처",
                "description": "연결된 폼을 조회할 내담자 바우처의 UUID.",
            },
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
            },
        },
        "required": ["client_voucher_id"],
    },
}
