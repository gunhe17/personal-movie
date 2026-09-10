from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.payment.factory import get_toss_client
from app.modules.event import emit
from app.modules.llm.facade import CreditFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionResponse


async def confirm_upgrade_handler(
    center_id: str,
    payment_key: str,
    order_id: str,
    amount: int,
    *,
    uow: UnitOfWork,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> SubscriptionResponse:
    # 토스 결제 승인은 UoW 밖에서 — 외부 API라 롤백 불가.
    toss_response = await get_toss_client().confirm_payment(
        payment_key=payment_key,
        order_id=order_id,
        amount=amount,
    )

    sub_facade = SubscriptionFacade(uow)
    atomics, response = await sub_facade.confirm_upgrade_by_plan(
        center_id=center_id,
        payment_key=payment_key,
        order_id=order_id,
        amount=amount,
        toss_response=toss_response,
    )

    credit_facade = CreditFacade(uow)
    credit_atomic, _ = await credit_facade.initialize_credit(
        center_id=center_id,
        plan_type=response.plan,
        period_start=response.current_period_start,
        period_end=response.current_period_end,
    )

    # 결제 확정 + 플랜 업그레이드 = 한 결제 워크플로의 사실(payment confirmed + subscription upgraded)
    await emit(
        uow,
        "subscription_upgraded",
        event_group_id=event_group_id,
        atomics=[*atomics, credit_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return response


TOOL = {
    "name": "confirm_upgrade_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "결제 완료 후 요금제 업그레이드를 확정한다.",
    "keywords": [
        "confirm upgrade",
        "업그레이드 확정",
        "결제 확정",
        "구독 결제 완료",
        "upgrade 확정",
    ],
    "boundaries": "결제(payment_key) 검증 후 업그레이드를 '확정'한다. 업그레이드 시작은 upgrade_plan_handler.",
    "output": "업그레이드가 확정된 구독 (SubscriptionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "업그레이드를 확정할 센터의 UUID.",
            },
            "payment_key": {
                "type": "string",
                "title": "결제 키",
                "description": "결제사에서 발급한 결제 키.",
            },
            "order_id": {
                "type": "string",
                "format": "uuid",
                "title": "주문 식별자",
                "description": "주문 식별자.",
            },
            "amount": {
                "type": "integer",
                "title": "결제 금액",
                "description": "결제 금액(원).",
            },
        },
        "required": ["center_id", "payment_key", "order_id", "amount"],
    },
}
