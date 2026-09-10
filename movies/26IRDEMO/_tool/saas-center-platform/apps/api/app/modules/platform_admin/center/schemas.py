import math
from datetime import datetime

from pydantic import BaseModel

from app.modules.subscription.subscription.schemas import (
    CreditSummary,
    SubscriptionHistoryItem,
    SubscriptionResponse,
)


class AdminCenterSummary(BaseModel):
    id: str
    name: str
    code: str
    representative_name: str | None
    phone: str | None
    is_active: bool
    member_count: int
    plan: str = "free"
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminCenterMember(BaseModel):
    id: str
    account_id: str
    name: str
    email: str
    role_name: str
    status: str


class AdminAddressInfo(BaseModel):
    zip_code: str | None = None
    address: str | None = None
    detail: str | None = None


class AdminCenterDetailResponse(BaseModel):
    id: str
    name: str
    code: str
    phone: str | None
    address: AdminAddressInfo | None
    business_registration_number: str | None
    representative_name: str | None
    logo_url: str | None
    is_active: bool
    created_at: datetime
    members: list[AdminCenterMember]

    model_config = {"from_attributes": True}


class AdminCenterClient(BaseModel):
    id: str
    code: str
    masked_name: str
    status: str
    gender: str | None
    created_at: datetime


class AdminCenterClientStats(BaseModel):
    total: int
    active: int
    inactive: int


class AdminCenterClientListResponse(BaseModel):
    items: list[AdminCenterClient]
    stats: AdminCenterClientStats
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminCenterClient],
        stats: AdminCenterClientStats,
        total: int,
        page: int,
        size: int,
    ) -> "AdminCenterClientListResponse":
        return cls(
            items=items,
            stats=stats,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ─── 센터 액션 요청/응답 ───


class CenterSuspendRequest(BaseModel):
    reason: str
    suspended_until: str | None = None


class CenterWarnRequest(BaseModel):
    reason: str
    notify: bool = True


class CenterTerminateRequest(BaseModel):
    reason: str
    notify_center: bool = True


class AdminCenterActionResponse(BaseModel):
    id: str
    name: str
    is_active: bool
    message: str


# ─── 해지 센터 목록 ───


class TerminatedCenterSummary(BaseModel):
    id: str
    name: str
    code: str
    representative_name: str | None
    business_registration_number: str | None
    deleted_at: datetime
    retention_expires_at: datetime
    retention_remaining_days: int
    is_expired: bool
    has_pending_export: bool = False
    export_count: int = 0

    model_config = {"from_attributes": True}


class TerminatedCenterListResponse(BaseModel):
    items: list[TerminatedCenterSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[TerminatedCenterSummary],
        total: int,
        page: int,
        size: int,
    ) -> "TerminatedCenterListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )


# ─── 센터 구독 탭 (센터 상세 내 구독/크레딧/AI 사용량 통합) ───


class PurposeUsage(BaseModel):
    purpose: str
    label: str
    calls: int
    total_credits: int


class CenterAiUsageSummary(BaseModel):
    total_calls: int
    total_credits: int
    by_purpose: list[PurposeUsage]
    period_start: datetime | None = None
    period_end: datetime | None = None


class CenterSubscriptionTabResponse(BaseModel):
    subscription: SubscriptionResponse | None = None
    credit: CreditSummary | None = None
    history: list[SubscriptionHistoryItem] = []
    ai_usage: CenterAiUsageSummary | None = None


class AdminCenterListResponse(BaseModel):
    items: list[AdminCenterSummary]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def build(
        cls,
        items: list[AdminCenterSummary],
        total: int,
        page: int,
        size: int,
    ) -> "AdminCenterListResponse":
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if size > 0 else 0,
        )
