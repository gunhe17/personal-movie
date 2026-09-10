from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.llm.facade import CreditFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import (
    AdminSubscriptionDetailResponse,
    CreditSummary,
)
from app.modules.event import emit


async def get_subscription_detail_handler(
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    actor_id: str,
) -> AdminSubscriptionDetailResponse:
    sub_facade = SubscriptionFacade(uow)
    credit_facade = CreditFacade(uow)
    center_facade = CenterFacade(uow)

    center = await center_facade.get_center(center_id)
    subscription = await sub_facade.get_subscription_with_response(center_id)
    history = await sub_facade.get_history(center_id)
    atomics, balance = await credit_facade.find_balance(center_id)

    credit = None
    if balance:
        credit = CreditSummary(
            credit_limit=balance.credit_limit,
            credit_used=balance.credit_used,
            credit_remaining=max(0, balance.credit_limit - balance.credit_used),
            period_start=balance.period_start,
            period_end=balance.period_end,
        )

    response = AdminSubscriptionDetailResponse(
        center_name=center.name,
        subscription=subscription,
        credit=credit,
        history=history,
    )
    await emit(
        uow,
        "credit_period_rolled",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
        actor_type="admin",
    )
    return response


TOOL = {
    "name": "get_subscription_detail_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터의 구독 상세 정보를 조회한다.",
    "keywords": [
        "get subscription detail",
        "구독 조회",
        "구독 상세",
        "요금제 정보",
        "subscription 상세",
        "플랜 조회",
    ],
    "boundaries": "한 센터의 구독 상세(읽기 전용). 전체 사용 개요는 get_usage_overview_handler.",
    "output": "센터 구독 상세 (AdminSubscriptionDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "구독 상세를 조회할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
