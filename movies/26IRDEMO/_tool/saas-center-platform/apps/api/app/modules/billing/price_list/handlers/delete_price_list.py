from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PriceListFacade
from app.modules.billing.price_list.schemas import PriceListDeleteResponse
from app.modules.event import emit


async def delete_price_list_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    price_list_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> PriceListDeleteResponse:
    facade = PriceListFacade(uow)
    atomic, _ = await facade.delete_price_list(
        center_id=center_id,
        price_list_id=price_list_id,
    )
    await emit(
        uow,
        "price_list_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return PriceListDeleteResponse(detail="삭제되었습니다.")


TOOL = {
    "name": "delete_price_list_handler",
    "permission": "delete:billing",
    "purpose": "가격표 항목을 삭제한다.",
    "keywords": ["delete price list", "가격표 삭제", "요금표 제거", "price list 삭제"],
    "boundaries": "가격표 삭제. 조회는 get_price_list_handler.",
    "output": "삭제 결과 (PriceListDeleteResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "price_list_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 가격표",
                "description": "삭제할 가격표의 UUID.",
            },
        },
        "required": ["price_list_id"],
    },
}
