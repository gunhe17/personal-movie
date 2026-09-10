# 현재 기간 만료 시 자동 전환 — 즉시 적용하지 않음.

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def reserve_downgrade_handler(
    center_id: str,
    target_plan: str,
    *,
    uow: UnitOfWork,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> SubscriptionResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.reserve_downgrade_with_response(
        center_id,
        target_plan,
    )
    await emit(
        uow,
        "subscription_downgrade_reserved",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": "reserve_downgrade_handler",
    "permission": None,
    "purpose": "센터가 다운그레이드를 예약한다.",
    "keywords": ["다운그레이드 예약", "강등 예약", "reserve downgrade"],
    "boundaries": "센터가 다운그레이드를 '예약'. 취소는 cancel_downgrade_handler.",
    "output": "다운그레이드 예약 후 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "다운그레이드를 예약할 센터의 UUID.",
            },
            "target_plan": {
                "type": "string",
                "title": "목표 요금제",
                "description": "내릴 목표 요금제.",
            },
        },
        "required": ["center_id", "target_plan"],
    },
}
