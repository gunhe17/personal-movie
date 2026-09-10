from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.client_voucher.schemas import ClientVoucherResponse
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def get_client_voucher_handler(
    center_id: str,
    client_voucher_id: str,
    uow: UnitOfWork,
) -> ClientVoucherResponse:
    facade = ClientVoucherFacade(uow)
    return await facade.get_client_voucher_with_response(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
    )


TOOL = {
    "name": "get_client_voucher_handler",
    "permission": "read:voucher",
    "purpose": "내담자 바우처 한 건을 조회한다.",
    "keywords": ["내담자 바우처 조회", "이용권 상세"],
    "boundaries": "단건 내담자 바우처 조회(읽기). 목록은 list_client_vouchers_handler, 사용현황은 application의 get_voucher_usage_handler.",
    "output": "내담자 바우처 상세 (ClientVoucherResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자 바우처",
                "description": "조회할 내담자 바우처의 UUID.",
            },
        },
        "required": ["client_voucher_id"],
    },
}
