from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.form.schemas import FormSummary
from app.modules.client.facade.resource_facade import ResourceFacade
from app.modules.voucher.facade.client_voucher_resource_facade import (
    ClientVoucherResourceFacade,
)
from app.application.schemas import ClientFormInstanceItem


async def link_voucher_form_instance_handler(
    center_id: str,
    client_voucher_id: str,
    template_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ClientFormInstanceItem:
    voucher_resource_facade = ClientVoucherResourceFacade(uow)
    client_voucher = await voucher_resource_facade.get_client_voucher(
        client_voucher_id=client_voucher_id,
        center_id=center_id,
    )

    # 공용 서식은 센터 양식으로 먼저 들여온 뒤 발급한다 — 발급본이 센터 소유가 아니면
    # 센터가 그 서식을 고칠 수도, 양식 관리에서 자기 것으로 다룰 수도 없다.
    template_atomic, template = await FormTemplateFacade(uow).import_center_template(
        template_id=template_id, center_id=center_id
    )

    form_facade = FormFacade(uow)
    form_atomic, instance = await form_facade.create_instance(
        center_id=center_id,
        template_id=template.id,
    )

    # 내담자 매핑도 같이 건다 — 바우처 연결 해제와 무관하게 문서관리 탭에 유지.
    resource_facade = ResourceFacade(uow)
    client_mapping_atomic, _client_mapping = await resource_facade.link_form_instance(
        center_id=center_id,
        client_id=client_voucher.client_id,
        instance_id=instance.id,
    )

    mapping_atomic, mapping = await voucher_resource_facade.link_form_instance(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
        instance_id=instance.id,
    )

    await emit(
        uow,
        "voucher_form_instance_linked",
        event_group_id=event_group_id,
        atomics=[
            *([template_atomic] if template_atomic else []),
            form_atomic, client_mapping_atomic, mapping_atomic,
        ],
        center_id=center_id,
        actor_id=actor_id,
    )

    return ClientFormInstanceItem(
        mapping_id=mapping.id,
        instance=FormSummary.model_validate(instance),
        created_at=mapping.created_at,
    )


TOOL = {
    "name": "link_voucher_form_instance_handler",
    "permission": "write:form_instance",
    "purpose": "내담자 바우처에 폼(설문) 템플릿을 연결한다.",
    "keywords": [
        "link voucher form instance",
        "바우처 폼 연결",
        "이용권 설문 연결",
        "바우처 양식 발급",
        "voucher form 연결",
    ],
    "boundaries": "바우처에 폼 인스턴스를 '연결/발급'한다. 연결 해제는 unlink_voucher_form_instance_handler, 목록은 list_voucher_forms_handler.",
    "output": "연결된 폼 인스턴스 (ClientFormInstanceItem).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자 바우처",
                "description": "폼을 연결할 내담자 바우처의 UUID.",
            },
            "template_id": {
                "type": "string",
                "format": "uuid",
                "title": "폼 템플릿",
                "description": "연결할 폼 템플릿의 UUID.",
            },
        },
        "required": ["client_voucher_id", "template_id"],
    },
}
