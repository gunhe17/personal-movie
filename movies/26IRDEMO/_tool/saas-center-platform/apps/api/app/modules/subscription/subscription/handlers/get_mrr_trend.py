from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import MrrTrendResponse


async def get_mrr_trend_handler(
    *,
    months: int = 6,
    uow: UnitOfWork,
) -> MrrTrendResponse:
    facade = SubscriptionFacade(uow)
    return await facade.get_mrr_trend(months)


TOOL = {
    "name": "get_mrr_trend_handler",
    "permission": None,
    "purpose": "월별 반복매출(MRR) 추이를 조회한다.",
    "keywords": ["MRR 추이", "매출 추이", "mrr trend", "반복매출"],
    "boundaries": "운영자 전용 — MRR 추이(읽기). 결제 통계는 admin_payment_stats_handler.",
    "output": "MRR 추이 (MrrTrendResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "months": {
                "type": "integer",
                "title": "개월 수",
                "description": "조회할 개월 수(기본 6).",
            },
        },
        "required": [],
    },
}
