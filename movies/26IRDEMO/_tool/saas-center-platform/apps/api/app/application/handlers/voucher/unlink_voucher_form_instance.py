# 바우처 매핑(client_voucher_resources)만 삭제. 내담자 매핑(client_resources)과
# 인스턴스 자체는 유지 — 내담자 문서관리 탭에서는 계속 보인다.
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.voucher.facade.client_voucher_resource_facade import (
    ClientVoucherResourceFacade,
)


async def unlink_voucher_form_instance_handler(
    center_id: str,
    mapping_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> None:
    facade = ClientVoucherResourceFacade(uow)
    atomic, _resource = await facade.unlink_resource(
        mapping_id=mapping_id,
        center_id=center_id,
    )
    await emit(
        uow,
        "client_voucher_resource_unlinked",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )


TOOL = {
    "name": "unlink_voucher_form_instance_handler",
    "permission": "delete:form_instance",
    "purpose": "바우처에 연결된 폼을 연결 해제한다.",
    "keywords": ['unlink voucher form instance', "바우처 폼 해제", "설문 연결 해제", "양식 분리", "voucher form 해제"],
    "boundaries": "바우처-폼 연결을 '해제'한다. 연결은 link_voucher_form_instance_handler.",
    "output": "없음 (연결 해제).",
    "input_schema": {
        "type": "object",
        "properties": {
            "mapping_id": {"type": "string", "format": "uuid", "title": "대상 연결", "description": "해제할 바우처-폼 연결의 UUID."},
        },
        "required": ["mapping_id"],
    },
}
