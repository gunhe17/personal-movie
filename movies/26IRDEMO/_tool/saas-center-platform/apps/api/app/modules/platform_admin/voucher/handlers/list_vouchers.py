from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.voucher.repository import VoucherRepository

from ..schemas import AdminVoucherListResponse, AdminVoucherSummary


async def list_vouchers_handler(
    uow: UnitOfWork,
    *,
    q: str | None = None,
    year: int | None = None,
    organization: str | None = None,
    page: int = 1,
    size: int = 20,
) -> AdminVoucherListResponse:
    repo = uow.repo(VoucherRepository)
    rows, page_meta = await repo.list_with_filters_with_page(
        q=q,
        year=year,
        organization=organization,
        page=page,
        size=size,
    )

    items = [AdminVoucherSummary.model_validate(v) for v in rows]
    return AdminVoucherListResponse.build(
        items=items, total=page_meta["total"], page=page, size=size
    )


TOOL = {
    "name": "list_vouchers_handler",
    "permission": None,
    "purpose": "운영자용 바우처 목록을 검색·연도·기관으로 조회한다.",
    "keywords": ["바우처 목록", "admin voucher 리스트", "바우처 카탈로그"],
    "boundaries": "운영자 전용 — 바우처 목록(읽기). 단건은 get_admin_voucher_handler.",
    "output": "운영자용 바우처 목록 (AdminVoucherListResponse).",
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
        "required": [],
    },
}
