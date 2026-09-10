from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.client_voucher.schemas import ClientVoucherListResponse
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def list_client_vouchers_handler(
    center_id: str,
    client_id: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> ClientVoucherListResponse:
    facade = ClientVoucherFacade(uow)
    return await facade.list_client_vouchers_with_response(
        center_id=center_id,
        client_id=client_id,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_client_vouchers_handler",
    "permission": "read:voucher",
    "purpose": "내담자 바우처 목록을 조회한다.",
    "keywords": ["내담자 바우처 목록", "이용권 목록"],
    "boundaries": "내담자 바우처 목록(읽기). 단건은 get_client_voucher_handler.",
    "output": "내담자 바우처 목록 (ClientVoucherListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 필터",
                "description": "특정 내담자로 한정(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": ["page", "size"],
    },
}
