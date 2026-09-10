from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade.price_list_facade import PriceListFacade
from app.modules.billing.price_list.schemas import PriceListResponse


async def find_price_lists_by_references_handler(
    center_id: str,
    reference_ids: list[str],
    uow: UnitOfWork,
) -> list[PriceListResponse]:
    facade = PriceListFacade(uow)
    return await facade.list_by_reference_ids_with_response(
        center_id=center_id,
        reference_ids=reference_ids,
    )


TOOL = {
    "name": "find_price_lists_by_references_handler",
    "permission": "read:billing",
    "purpose": "참조 ID 목록으로 연관된 가격표들을 찾는다.",
    "keywords": ["가격표 참조 조회", "연관 단가", "reference로 가격표"],
    "boundaries": "참조 대상에 묶인 가격표 조회(읽기). 전체 목록은 list_price_lists_handler.",
    "output": "참조에 연관된 가격표 목록 (PriceListResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "reference_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "참조 ID 목록",
                "description": "가격표를 찾을 참조 대상 UUID 목록.",
            },
        },
        "required": ["reference_ids"],
    },
}
