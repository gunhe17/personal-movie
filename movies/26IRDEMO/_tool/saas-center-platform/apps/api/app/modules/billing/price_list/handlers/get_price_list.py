from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PriceListFacade
from app.modules.billing.price_list.schemas import PriceListResponse


async def get_price_list_handler(
    center_id: str,
    price_list_id: str,
    uow: UnitOfWork,
) -> PriceListResponse:
    facade = PriceListFacade(uow)
    result = await facade.get_price_list_with_response(
        center_id=center_id,
        price_list_id=price_list_id,
    )
    return result


TOOL = {
    "name": "get_price_list_handler",
    "permission": "read:billing",
    "purpose": "가격표 항목 한 건을 조회한다.",
    "keywords": ["가격표 조회", "요금표 상세", "price list 조회"],
    "boundaries": "단건 가격표 조회(읽기). 목록은 list_price_lists_handler.",
    "output": "가격표 항목 상세 (PriceListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "price_list_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 가격표",
                "description": "조회할 가격표의 UUID.",
            },
        },
        "required": ["price_list_id"],
    },
}
