from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.schemas import VoucherCatalogListResponse
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def list_voucher_catalog_handler(
    center_id: str,
    q: str | None,
    year: int | None,
    organization: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> VoucherCatalogListResponse:
    facade = CenterVoucherFacade(uow)
    return await facade.list_voucher_catalog_with_response(
        center_id=center_id,
        q=q,
        year=year,
        organization=organization,
        page=page,
        size=size,
    )


TOOL = {
    "name": "list_voucher_catalog_handler",
    "permission": "read:voucher",
    "purpose": "바우처 카탈로그(상품 목록)를 검색·연도·기관으로 거르고 조회한다.",
    "keywords": ["바우처 카탈로그", "이용권 상품 목록", "voucher catalog"],
    "boundaries": "발급 가능한 바우처 카탈로그(읽기). 센터 발급 바우처는 list_center_vouchers_handler.",
    "output": "발급 가능한 바우처 카탈로그 목록 (VoucherCatalogListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "q": {
                "type": "string",
                "title": "검색어",
                "description": "이름 등 검색어(선택).",
            },
            "year": {
                "type": "integer",
                "title": "연도 필터",
                "description": "프로그램 연도 필터(선택).",
            },
            "organization": {
                "type": "string",
                "title": "기관 필터",
                "description": "주관 기관 필터(선택).",
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
