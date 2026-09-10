from datetime import datetime

from pydantic import BaseModel, Field

from .plan_config import PlanType, PlanConfig, PLAN_CONFIGS


# ── Response DTOs ──

class PlanLimits(BaseModel):
    credit_limit: int
    features: list[str]


class PlanMeta(BaseModel):
    tagline: str = ""
    audience: str = ""
    is_recommended: bool = False
    base_features: list[str] = []
    additions: list[str] = []
    base_plan: str | None = None
    badge_bg: str = "bg-gray-100"
    badge_text: str = "text-gray-600"
    feature_labels: dict[str, str] = {}
    feature_descriptions: dict[str, str] = {}


class PlanInfo(BaseModel):
    plan: str
    label: str
    price_monthly: int
    limits: PlanLimits
    meta: PlanMeta = PlanMeta()


class SubscriptionResponse(BaseModel):
    id: str
    center_id: str
    plan: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: datetime | None = None
    is_quota_exceeded: bool = False
    reserved_plan: str | None = None
    reserved_at: datetime | None = None
    limits: PlanLimits

    model_config = {"from_attributes": True}


class SubscriptionHistoryItem(BaseModel):
    from_plan: str | None
    to_plan: str
    actor_type: str
    reason: str
    from_status: str | None = None
    to_status: str | None = None
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Admin Response DTOs ──

class AdminSubscriptionSummary(BaseModel):
    id: str
    center_id: str
    center_name: str
    plan: str
    status: str
    credit_used: int = 0
    credit_limit: int = 0
    current_period_start: datetime
    current_period_end: datetime
    is_quota_exceeded: bool = False
    reserved_plan: str | None = None
    reserved_at: datetime | None = None


class AdminSubscriptionListResponse(BaseModel):
    items: list[AdminSubscriptionSummary]
    total: int
    page: int
    size: int
    pages: int


class AdminSubscriptionDetailResponse(BaseModel):
    center_name: str
    subscription: SubscriptionResponse
    credit: "CreditSummary | None" = None
    history: list[SubscriptionHistoryItem] = []


class CreditSummary(BaseModel):
    credit_limit: int
    credit_used: int
    credit_remaining: int
    period_start: datetime
    period_end: datetime


class SubscriptionStatsResponse(BaseModel):
    by_plan: dict[str, int]
    quota_exceeded_count: int
    total: int
    scheduled_downgrade_count: int = 0
    churn_rate: float = 0.0
    churned_count: int = 0


# ── Admin 분석 Dashboard DTOs ──


class CenterUsageRank(BaseModel):
    center_id: str
    center_name: str
    plan: str
    credit_used: int
    credit_limit: int
    usage_pct: int


class FeatureUsageStat(BaseModel):
    purpose: str
    label: str
    total_calls: int
    total_credits: int


class SubscriptionUsageOverviewResponse(BaseModel):
    by_plan: dict[str, int]
    quota_exceeded_count: int
    total_centers: int
    top_credit_users: list[CenterUsageRank]
    feature_usage: list[FeatureUsageStat]


# ── Request DTOs ──

class UpgradePlanRequest(BaseModel):
    plan: str
    reason: str = "upgrade"


class ChangePlanRequest(BaseModel):
    plan: str
    reason: str = "plan_change"


class GrantTrialRequest(BaseModel):
    reason: str = "trial_granted"
    duration_days: int | None = None  # None이면 기본값(365일) 사용


class AdjustCreditRequest(BaseModel):
    adjust_type: str = Field(..., pattern="^(add|reset)$", description="add: 한도 추가, reset: 사용량 초기화")
    amount: int = Field(0, ge=0, description="추가할 크레딧 양 (type=add일 때 필수)")
    reason: str = "manual_adjustment"


# ── 결제 관련 DTOs ──

class InitiateUpgradeRequest(BaseModel):
    plan: str


class ConfirmUpgradeRequest(BaseModel):
    payment_key: str = Field(..., alias="paymentKey")
    order_id: str = Field(..., alias="orderId")
    amount: int

    model_config = {"populate_by_name": True}


class TransitionStatusRequest(BaseModel):
    status: str
    reason: str
    force: bool = False


class RequestPlanChangeRequest(BaseModel):
    plan: str


class RejectPlanChangeRequest(BaseModel):
    reason: str = "plan_change_rejected"


class ReserveDowngradeRequest(BaseModel):
    plan: str


class InitiateUpgradeResponse(BaseModel):
    order_id: str
    amount: int
    plan: str
    plan_label: str


class SubscriptionPaymentSummary(BaseModel):
    id: str
    plan: str
    amount: int
    status: str
    method: str | None = None
    paid_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TossClientKeyResponse(BaseModel):
    client_key: str


# ── 결제 관리 (Admin) ──

class PaymentListResponse(BaseModel):
    items: list[SubscriptionPaymentSummary]
    total: int
    page: int
    size: int
    pages: int


class FailedPaymentSummary(BaseModel):
    id: str
    center_id: str
    center_name: str
    plan: str
    amount: int
    failed_reason: str | None = None
    created_at: datetime


class FailedPaymentListResponse(BaseModel):
    items: list[FailedPaymentSummary]
    total: int
    page: int
    size: int
    pages: int


class CancelPaymentRequest(BaseModel):
    payment_id: str
    reason: str


class PaymentStatsResponse(BaseModel):
    failed_count: int
    mrr: int
    total_confirmed_this_month: int
    revenue_by_plan: dict[str, int] = {}


# ── MRR 추이 ──

class MrrTrendItem(BaseModel):
    year: int
    month: int
    mrr: int
    confirmed_count: int


class MrrTrendResponse(BaseModel):
    items: list[MrrTrendItem]


# ── Helper ──

def build_plan_limits(config: PlanConfig) -> PlanLimits:
    return PlanLimits(
        credit_limit=config.credit_limit,
        features=sorted(config.features),
    )


def build_plan_list() -> list[PlanInfo]:
    return [
        PlanInfo(
            plan=p.value,
            label=c.label,
            price_monthly=c.price_monthly,
            limits=build_plan_limits(c),
            meta=PlanMeta(
                tagline=c.tagline,
                audience=c.audience,
                is_recommended=c.is_recommended,
                base_features=list(c.base_features),
                additions=list(c.additions),
                base_plan=c.base_plan,
                badge_bg=c.badge_bg,
                badge_text=c.badge_text,
                feature_labels=c.feature_labels,
                feature_descriptions=c.feature_descriptions,
            ),
        )
        for p, c in PLAN_CONFIGS.items()
        if p != PlanType.ENTERPRISE  # Enterprise는 목록에서 제외 (별도 계약)
    ]
