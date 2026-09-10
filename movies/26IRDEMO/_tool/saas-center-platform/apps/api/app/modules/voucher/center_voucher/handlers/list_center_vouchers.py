from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.schemas import CenterVoucherListResponse
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def list_center_vouchers_handler(
    center_id: str,
    is_active: bool | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> CenterVoucherListResponse:
    facade = CenterVoucherFacade(uow)
    return await facade.list_center_vouchers_with_response(
        center_id=center_id,
        is_active=is_active,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_center_vouchers_handler",
    "permission": "read:voucher",
    "purpose": "센터 바우처 목록을 활성여부로 거르고 조회한다.",
    "keywords": ["센터 바우처 목록", "이용권 목록"],
    "boundaries": "센터 바우처 목록(읽기). 단건은 get_center_voucher_handler.",
    "output": "센터 바우처 목록 (CenterVoucherListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "is_active": {
                "type": "boolean",
                "title": "활성 여부 필터",
                "description": "활성 여부 필터(선택).",
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
