from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.schemas import CenterVoucherResponse
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def get_center_voucher_handler(
    center_id: str,
    center_voucher_id: str,
    uow: UnitOfWork,
) -> CenterVoucherResponse:
    facade = CenterVoucherFacade(uow)
    return await facade.get_center_voucher_with_response(
        center_id=center_id,
        center_voucher_id=center_voucher_id,
    )


TOOL = {
    "name": "get_center_voucher_handler",
    "permission": "read:voucher",
    "purpose": "센터 바우처 한 건을 조회한다.",
    "keywords": ["센터 바우처 조회", "이용권 상세"],
    "boundaries": "단건 센터 바우처 조회(읽기). 목록은 list_center_vouchers_handler.",
    "output": "센터 바우처 상세 (CenterVoucherResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터 바우처",
                "description": "조회할 센터 바우처의 UUID.",
            },
        },
        "required": ["center_voucher_id"],
    },
}
