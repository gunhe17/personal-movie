from pydantic import BaseModel


# ── 시스템 설정 ──

class PlatformSettingsResponse(BaseModel):
    trial_duration_days: int
    trial_plan: str
    credit_cycle_days: int
    quota_grace_days: int


class PlatformSettingsUpdate(BaseModel):
    trial_duration_days: int | None = None
    trial_plan: str | None = None
    credit_cycle_days: int | None = None
    quota_grace_days: int | None = None


# ── 플랜 설정 ──

class PlanConfigResponse(BaseModel):
    id: str
    plan_type: str
    label: str
    price_monthly: int
    credit_limit: int
    features: list[str]
    plan_order: int
    is_active: bool
    # UI 메타데이터
    tagline: str | None = None
    audience: str | None = None
    is_recommended: bool = False
    base_features: list[str] = []
    additions: list[str] = []
    base_plan: str | None = None
    badge_bg: str | None = None
    badge_text: str | None = None
    feature_labels: dict[str, str] = {}
    feature_descriptions: dict[str, str] = {}


class PlanConfigUpdate(BaseModel):
    label: str | None = None
    price_monthly: int | None = None
    credit_limit: int | None = None
    features: list[str] | None = None
    plan_order: int | None = None
    is_active: bool | None = None
    # UI 메타데이터
    tagline: str | None = None
    audience: str | None = None
    is_recommended: bool | None = None
    base_features: list[str] | None = None
    additions: list[str] | None = None
    base_plan: str | None = None
    badge_bg: str | None = None
    badge_text: str | None = None
    feature_labels: dict[str, str] | None = None
    feature_descriptions: dict[str, str] | None = None


class PlanConfigListResponse(BaseModel):
    items: list[PlanConfigResponse]
