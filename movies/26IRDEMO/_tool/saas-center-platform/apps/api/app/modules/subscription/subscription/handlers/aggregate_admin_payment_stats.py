from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import PaymentStatsResponse


async def aggregate_admin_payment_stats_handler(
    *,
    year: int,
    month: int,
    uow: UnitOfWork,
) -> PaymentStatsResponse:
    facade = SubscriptionFacade(uow)
    result = await facade.get_payment_stats_with_response(
        year=year,
        month=month,
    )
    return result


TOOL = {
    "name": "aggregate_admin_payment_stats_handler",
    "permission": None,
    "purpose": "월별 결제 통계를 조회한다.",
    "keywords": ["결제 통계", "매출 통계", "payment stats"],
    "boundaries": "운영자 전용 — 월별 결제 통계(읽기). MRR 추이는 mrr_trend_handler.",
    "output": "결제 통계 (PaymentStatsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "year": {"type": "integer", "title": "연도", "description": "조회 연도."},
            "month": {
                "type": "integer",
                "title": "월",
                "description": "조회 월(1~12).",
            },
        },
        "required": ["year", "month"],
    },
}
