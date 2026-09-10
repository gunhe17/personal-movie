from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.llm.facade import CreditFacade, LlmCallFacade
from app.modules.llm.schemas import PURPOSE_LABELS, TOKENS_PER_CREDIT
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import CreditSummary
from app.modules.platform_admin.center.schemas import (
    CenterAiUsageSummary,
    CenterSubscriptionTabResponse,
    PurposeUsage,
)
from app.modules.event import emit


async def get_center_subscription_tab_handler(
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    actor_id: str,
) -> CenterSubscriptionTabResponse:
    sub_facade = SubscriptionFacade(uow)
    subscription, history = await sub_facade.get_subscription_tab_data(center_id)

    credit_facade = CreditFacade(uow)
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

    date_from = balance.period_start if balance else None
    date_to = balance.period_end if balance else None

    llm_facade = LlmCallFacade(uow)
    totals, by_purpose, _ = await llm_facade.get_center_usage_summary(
        center_id=center_id,
        date_from=date_from,
        date_to=date_to,
    )

    ai_usage = None
    if totals["total_calls"] > 0:
        tpc = TOKENS_PER_CREDIT if TOKENS_PER_CREDIT > 0 else 1
        purpose_items = [
            PurposeUsage(
                purpose=item["purpose"],
                label=PURPOSE_LABELS.get(
                    item["purpose"] or "",
                    item["purpose"] or "기타",
                ),
                calls=item["calls"],
                total_credits=item["total_tokens"] // tpc,
            )
            for item in by_purpose
            if item["total_tokens"] > 0
        ]
        total_tokens = totals["total_input_tokens"] + totals["total_output_tokens"]
        ai_usage = CenterAiUsageSummary(
            total_calls=totals["total_calls"],
            total_credits=total_tokens // tpc,
            by_purpose=purpose_items,
            period_start=date_from,
            period_end=date_to,
        )

    response = CenterSubscriptionTabResponse(
        subscription=subscription,
        credit=credit,
        history=history,
        ai_usage=ai_usage,
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
    "name": "get_center_subscription_tab_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "센터 관리 화면의 구독 탭 정보를 조회한다.",
    "keywords": ["센터 구독 탭", "구독 정보 조회", "subscription tab"],
    "boundaries": "운영자 전용 — 센터 관리의 '구독 탭' 데이터(읽기). 센터 기본은 get_admin_center_handler.",
    "output": "센터 구독 탭 데이터 — 구독·크레딧·사용량 (CenterSubscriptionTabResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "조회할 센터의 UUID.",
            },
        },
        "required": ["center_id"],
    },
}
