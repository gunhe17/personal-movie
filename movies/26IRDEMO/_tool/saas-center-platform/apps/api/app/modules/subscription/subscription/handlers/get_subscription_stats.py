from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import SubscriptionStatsResponse


async def get_subscription_stats_handler(
    uow: UnitOfWork,
) -> SubscriptionStatsResponse:
    facade = SubscriptionFacade(uow)
    result = await facade.get_stats_with_response()

    return result


TOOL = {
    "name": "get_subscription_stats_handler",
    "permission": None,
    "purpose": "전체 구독 통계를 조회한다.",
    "keywords": ["구독 통계", "가입 현황", "subscription stats"],
    "boundaries": "운영자 전용 — 전체 구독 통계(읽기). MRR 추이는 get_mrr_trend_handler.",
    "output": "구독 통계 (SubscriptionStatsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
