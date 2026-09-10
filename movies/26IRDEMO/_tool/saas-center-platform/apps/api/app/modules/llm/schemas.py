from datetime import datetime

from pydantic import BaseModel

from app.modules.llm.credit_balance.plan_config import PURPOSE_LABELS, TOKENS_PER_CREDIT  # noqa: F401


class CreditBalanceResponse(BaseModel):
    plan_type: str
    credit_limit: int
    credit_used: int
    credit_remaining: int
    tokens_per_credit: int = 2000
    period_start: datetime
    period_end: datetime
    estimated_credits: dict[str, int] = {}

    model_config = {"from_attributes": True}


class CreditRateConfigResponse(BaseModel):
    tokens_per_credit: int
    effective_from: datetime
    changed_by: str | None = None
    reason: str | None = None

    model_config = {"from_attributes": True}


class CreditRateChangeRequest(BaseModel):
    tokens_per_credit: int
    reason: str | None = None


class CreditInitRequest(BaseModel):
    plan_type: str = "pro"
    period_start: datetime
    period_end: datetime


# ── 사용량 통계 ──


class UsagePurposeBreakdown(BaseModel):
    purpose: str | None
    purpose_label: str
    calls: int
    total_tokens: int
    credits: int

    model_config = {"from_attributes": True}


class DailyUsage(BaseModel):
    date: str  # "2026-04-15"
    tokens: int
    calls: int
    credits: int = 0

    model_config = {"from_attributes": True}


class DailyPurposeUsage(BaseModel):
    date: str
    purpose: str | None
    purpose_label: str = ""
    calls: int = 0
    credits: int = 0

    model_config = {"from_attributes": True}


class CreditUsageResponse(BaseModel):
    # Credit balance
    is_active: bool = True  # False면 활성 잔액 없음(만료) — 아래 값은 마지막 소비 기간
    plan_type: str | None = None
    credit_limit: int = 0
    credit_used: int = 0
    credit_remaining: int = 0
    tokens_per_credit: int = 2000
    period_start: datetime | None = None
    period_end: datetime | None = None
    # Usage stats
    total_calls: int = 0
    total_tokens: int = 0
    active_members: int = 0
    by_purpose: list[UsagePurposeBreakdown] = []
    daily_usage: list[DailyUsage] = []
    daily_by_purpose: list[DailyPurposeUsage] = []

    model_config = {"from_attributes": True}


# ── 최근 활동 내역 ──


class CreditHistoryItem(BaseModel):
    purpose: str | None
    purpose_label: str
    credits: int
    created_at: datetime
    member_id: str | None = None
    member_name: str | None = None

    model_config = {"from_attributes": True}


class CreditHistoryResponse(BaseModel):
    items: list[CreditHistoryItem] = []

    model_config = {"from_attributes": True}
