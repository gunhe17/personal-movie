from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def cancel_downgrade_handler(
    center_id: str,
    *,
    uow: UnitOfWork,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.cancel_downgrade_with_response(center_id)
    await emit(
        uow,
        "subscription_downgrade_cancelled",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": "cancel_downgrade_handler",
    "permission": None,
    "purpose": "예약된 다운그레이드를 취소한다.",
    "keywords": ["다운그레이드 취소", "강등 취소", "cancel downgrade"],
    "boundaries": "센터가 자기 예약 다운그레이드를 취소. 예약은 reserve_downgrade_handler.",
    "output": "다운그레이드 취소 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {'type': 'string', 'format': 'uuid', 'title': '대상 센터', 'description': '예약된 다운그레이드를 취소할 센터의 UUID.'},
        },
        "required": ["center_id"],
    },
}
