from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.voucher.center_voucher.schemas import CenterVoucherDeleteResponse
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def delete_center_voucher_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    center_voucher_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> CenterVoucherDeleteResponse:
    facade = CenterVoucherFacade(uow)
    atomic, _ = await facade.delete_center_voucher(
        center_id=center_id,
        center_voucher_id=center_voucher_id,
    )
    await emit(
        uow,
        "center_voucher_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CenterVoucherDeleteResponse(detail="센터 취급 바우처가 삭제되었습니다")


TOOL = {
    "name": "delete_center_voucher_handler",
    "permission": "delete:voucher",
    "purpose": "센터 바우처를 삭제한다.",
    "keywords": ['delete center voucher', "센터 바우처 삭제", "이용권 삭제"],
    "boundaries": "센터 바우처 삭제. 조회는 get_center_voucher_handler.",
    "output": "삭제 결과 (CenterVoucherDeleteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_voucher_id": {"type": "string", "format": "uuid", "title": "대상 센터 바우처", "description": "삭제할 센터 바우처의 UUID."},
        },
        "required": ["center_voucher_id"],
    },
}
