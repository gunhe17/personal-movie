from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.voucher.client_voucher.schemas import ClientVoucherDeleteResponse
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def delete_client_voucher_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_voucher_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientVoucherDeleteResponse:
    facade = ClientVoucherFacade(uow)
    atomic, _ = await facade.delete_client_voucher(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
    )
    await emit(
        uow,
        "client_voucher_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientVoucherDeleteResponse(detail="내담자 바우처가 삭제되었습니다")


TOOL = {
    "name": "delete_client_voucher_handler",
    "permission": "delete:voucher",
    "purpose": "내담자 바우처를 삭제한다.",
    "keywords": ['delete client voucher', "내담자 바우처 삭제", "이용권 회수"],
    "boundaries": "내담자 바우처 삭제. 조회는 get_client_voucher_handler.",
    "output": "삭제 결과 (ClientVoucherDeleteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_voucher_id": {"type": "string", "format": "uuid", "title": "대상 내담자 바우처", "description": "삭제할 내담자 바우처의 UUID."},
        },
        "required": ["client_voucher_id"],
    },
}
