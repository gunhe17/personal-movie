from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.llm.credit_balance.plan_config import (
    FREE_PURPOSES,
    PURPOSE_LABELS,
    TOKENS_PER_CREDIT,
)
from app.modules.llm.facade import LlmCallFacade
from app.modules.platform_admin.ai_usage.facade import AdminAiUsageFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.subscription.subscription.schemas import (
    CenterUsageRank,
    FeatureUsageStat,
    SubscriptionUsageOverviewResponse,
)


async def get_usage_overview_handler(
    uow: UnitOfWork,
    *,
    year: int | None = None,
    month: int | None = None,
    top_limit: int = 10,
) -> SubscriptionUsageOverviewResponse:
    # 기간·플랜별 분포
    period_start, period_end, by_plan, quota_exceeded = await SubscriptionFacade(
        uow
    ).get_usage_overview(year=year, month=month)
    total_centers = sum(by_plan.values())

    # 크레딧 사용 TOP 센터
    top_rows = await AdminAiUsageFacade(uow).aggregate_top_credit_users(
        limit=top_limit
    )

    top_credit_users = [
        CenterUsageRank(
            center_id=r["center_id"],
            center_name=r["center_name"],
            plan=r["plan"],
            credit_used=r["credit_used"],
            credit_limit=r["credit_limit"],
            usage_pct=(
                min(100, round((r["credit_used"] / r["credit_limit"]) * 100))
                if r["credit_limit"] > 0
                else 0
            ),
        )
        for r in top_rows
    ]

    # AI 기능별 사용량 (기간 필터 적용)
    paid_purposes = {
        p: label for p, label in PURPOSE_LABELS.items() if p not in FREE_PURPOSES
    }

    llm_facade = LlmCallFacade(uow)
    totals, by_purpose = await llm_facade.get_raw_production_usage(
        date_from=period_start,
        date_to=period_end,
    )

    merged: dict[str, dict] = {}
    for item in by_purpose:
        p = item["purpose"]
        if p not in paid_purposes:
            continue
        if p in merged:
            merged[p]["calls"] += item["calls"]
            merged[p]["tokens"] += item["input_tokens"] + item["output_tokens"]
        else:
            merged[p] = {
                "calls": item["calls"],
                "tokens": item["input_tokens"] + item["output_tokens"],
            }

    tpc = TOKENS_PER_CREDIT if TOKENS_PER_CREDIT > 0 else 1
    feature_usage = [
        FeatureUsageStat(
            purpose=p,
            label=label,
            total_calls=merged.get(p, {}).get("calls", 0),
            total_credits=merged.get(p, {}).get("tokens", 0) // tpc,
        )
        for p, label in paid_purposes.items()
    ]
    feature_usage.sort(key=lambda x: x.total_calls, reverse=True)

    return SubscriptionUsageOverviewResponse(
        by_plan=by_plan,
        quota_exceeded_count=quota_exceeded,
        total_centers=total_centers,
        top_credit_users=top_credit_users,
        feature_usage=feature_usage,
    )


TOOL = {
    "name": "get_usage_overview_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "플랫폼 전체의 구독·사용 개요를 월 단위로 조회한다.",
    "keywords": [
        "get usage overview",
        "사용 개요",
        "구독 통계",
        "전체 사용 현황",
        "usage overview",
        "구독 대시보드",
    ],
    "boundaries": "운영자 전용 — '전체' 사용 개요(월별, 상위 N). 특정 센터 구독은 get_subscription_detail_handler.",
    "output": "플랫폼 전체 월별 구독·사용 개요 (SubscriptionUsageOverviewResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "year": {
                "type": "integer",
                "title": "조회 연도",
                "description": "조회 연도(선택, 기본 현재).",
            },
            "month": {
                "type": "integer",
                "title": "조회 월",
                "minimum": 1,
                "maximum": 12,
                "description": "조회 월(선택).",
            },
            "top_limit": {
                "type": "integer",
                "title": "상위 N",
                "description": "상위 N개 제한(기본 10).",
            },
        },
        "required": [],
    },
}
