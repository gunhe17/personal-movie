# 토스 결제 위젯에 전달할 정보(order_id·amount 등)를 생성.

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import InitiateUpgradeResponse


async def initiate_upgrade_handler(
    center_id: str,
    target_plan: str,
    *,
    uow: UnitOfWork,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> InitiateUpgradeResponse:
    facade = SubscriptionFacade(uow)
    atomic, result = await facade.initiate_upgrade(center_id, target_plan)
    await emit(
        uow,
        "subscription_payment_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": "initiate_upgrade_handler",
    "permission": None,
    "purpose": "구독 업그레이드(결제)를 개시한다.",
    "keywords": ["업그레이드 시작", "결제 개시", "initiate upgrade"],
    "boundaries": "센터가 업그레이드를 '개시'(결제 준비). 변경 요청은 request_plan_change_handler.",
    "output": "업그레이드 시작 결과 — 결제 정보 (InitiateUpgradeResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "업그레이드할 센터의 UUID.",
            },
            "target_plan": {
                "type": "string",
                "title": "목표 요금제",
                "description": "업그레이드할 목표 요금제.",
            },
        },
        "required": ["center_id", "target_plan"],
    },
}
