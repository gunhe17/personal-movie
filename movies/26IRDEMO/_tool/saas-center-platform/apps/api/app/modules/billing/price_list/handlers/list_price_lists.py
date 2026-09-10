from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PriceListFacade
from app.modules.billing.price_list.schemas import (
    PriceListListResponse,
    ServiceType,
)


async def list_price_lists_handler(
    *,
    center_id: str,
    uow: UnitOfWork,
    service_type: ServiceType | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    page: int = 1,
    size: int = 50,
) -> PriceListListResponse:
    facade = PriceListFacade(uow)
    result = await facade.list_price_lists_with_response(
        center_id=center_id,
        service_type=service_type,
        is_active=is_active,
        search=search,
        page=page,
        size=size,
    )
    return result


TOOL = {
    "name": "list_price_lists_handler",
    "permission": "read:billing",
    "purpose": "가격표 목록을 서비스유형·활성·검색으로 거르고 조회한다.",
    "keywords": ["가격표 목록", "요금표 조회", "price list 목록", "단가표"],
    "boundaries": "가격표 목록(읽기). 단건은 get_price_list_handler.",
    "output": "가격표 목록 (PriceListListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "service_type": {
                "type": "string",
                "enum": ["counseling", "assessment", "package"],
                "title": "서비스 유형 필터",
                "description": "서비스 유형 필터(선택).",
            },
            "is_active": {
                "type": "boolean",
                "title": "활성 여부 필터",
                "description": "활성 여부 필터(선택).",
            },
            "search": {
                "type": "string",
                "title": "검색어",
                "description": "검색어(선택).",
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
