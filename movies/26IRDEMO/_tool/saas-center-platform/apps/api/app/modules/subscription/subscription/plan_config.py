"""구독 플랜 설정 — 단일 진실 공급원.

모든 플랜별 한도(크레딧, 내담자, 상담사)와 기능 플래그를 여기서 관리.
크레딧 모듈의 PLAN_CREDIT_LIMITS는 이 설정을 참조.

DB 관리:
  platform_settings 테이블(스칼라 설정)과 plan_configs 테이블(플랜별 설정)에서
  in-memory 캐시로 로드. 기존 API(get_plan_config, is_feature_allowed 등) 호환 유지.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class PlanType(StrEnum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    TRIAL = "trial"
    PENDING = "pending"
    PENDING_PAYMENT = "pending_payment"
    PAYMENT_FAILED = "payment_failed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class PlanConfig:
    label: str
    price_monthly: int  # 월 가격 (원)
    credit_limit: int  # AI 크레딧 한도 (0 = AI 미제공)
    features: frozenset[str] = field(default_factory=frozenset)

    # UI 메타데이터
    tagline: str = ""
    audience: str = ""
    is_recommended: bool = False
    base_features: tuple[str, ...] = ()
    additions: tuple[str, ...] = ()
    base_plan: str | None = None
    badge_bg: str = "bg-gray-100"
    badge_text: str = "text-gray-600"
    feature_labels: dict[str, str] = field(default_factory=dict)
    feature_descriptions: dict[str, str] = field(default_factory=dict)


# ── 하드코딩 폴백 (DB 미연결 시) ──

_DEFAULT_PLAN_CONFIGS: dict[PlanType, PlanConfig] = {
    PlanType.FREE: PlanConfig(
        label="Free",
        price_monthly=0,
        credit_limit=0,
        features=frozenset(),
    ),
    PlanType.STARTER: PlanConfig(
        label="Starter",
        price_monthly=29_000,
        credit_limit=600,
        features=frozenset({"ai_field_note"}),
    ),
    PlanType.PRO: PlanConfig(
        label="Pro",
        price_monthly=59_000,
        credit_limit=2_500,
        features=frozenset({"ai_field_note", "ai_agent", "ai_case_analysis"}),
    ),
    PlanType.ENTERPRISE: PlanConfig(
        label="Enterprise",
        price_monthly=0,
        credit_limit=8_000,
        features=frozenset({"ai_field_note", "ai_agent", "ai_case_analysis", "api_access"}),
    ),
}

_DEFAULT_PLAN_ORDER: dict[PlanType, int] = {
    PlanType.FREE: 0,
    PlanType.STARTER: 1,
    PlanType.PRO: 2,
    PlanType.ENTERPRISE: 3,
}

_DEFAULT_SCALARS: dict[str, str] = {
    "trial_duration_days": "365",
    "trial_plan": "pro",
    "credit_cycle_days": "30",
    "quota_grace_days": "7",
}


# ── 캐시 ──

class _PlanConfigCache:
    """프로세스 내 in-memory 캐시 (싱글톤). TTL 60초."""

    _instance: _PlanConfigCache | None = None
    TTL = 60  # seconds

    def __init__(self) -> None:
        self._configs: dict[PlanType, PlanConfig] = dict(_DEFAULT_PLAN_CONFIGS)
        self._plan_order: dict[PlanType, int] = dict(_DEFAULT_PLAN_ORDER)
        self._scalars: dict[str, str] = dict(_DEFAULT_SCALARS)
        self._last_loaded: float = 0.0

    @classmethod
    def get(cls) -> _PlanConfigCache:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def is_stale(self) -> bool:
        return time.time() - self._last_loaded > self.TTL

    def update(
        self,
        plan_rows: list[dict],
        setting_rows: list[dict],
    ) -> None:
        """DB에서 읽은 데이터로 캐시 갱신."""
        if plan_rows:
            new_configs: dict[PlanType, PlanConfig] = {}
            new_order: dict[PlanType, int] = {}
            for row in plan_rows:
                try:
                    pt = PlanType(row["plan_type"])
                except ValueError:
                    continue
                features_raw = row.get("features", "[]")
                features = frozenset(json.loads(features_raw) if isinstance(features_raw, str) else features_raw)
                # UI 메타데이터 파싱
                def _parse_json_list(val: str | list | None) -> tuple[str, ...]:
                    if val is None:
                        return ()
                    if isinstance(val, list):
                        return tuple(val)
                    try:
                        return tuple(json.loads(val))
                    except (json.JSONDecodeError, TypeError):
                        return ()

                def _parse_json_dict(val: str | dict | None) -> dict[str, str]:
                    if val is None:
                        return {}
                    if isinstance(val, dict):
                        return val
                    try:
                        return json.loads(val)
                    except (json.JSONDecodeError, TypeError):
                        return {}

                new_configs[pt] = PlanConfig(
                    label=row["label"],
                    price_monthly=row["price_monthly"],
                    credit_limit=row["credit_limit"],
                    features=features,
                    tagline=row.get("tagline") or "",
                    audience=row.get("audience") or "",
                    is_recommended=row.get("is_recommended", False),
                    base_features=_parse_json_list(row.get("base_features")),
                    additions=_parse_json_list(row.get("additions")),
                    base_plan=row.get("base_plan"),
                    badge_bg=row.get("badge_bg") or "bg-gray-100",
                    badge_text=row.get("badge_text") or "text-gray-600",
                    feature_labels=_parse_json_dict(row.get("feature_labels")),
                    feature_descriptions=_parse_json_dict(row.get("feature_descriptions")),
                )
                new_order[pt] = row.get("plan_order", 0)

            if new_configs:
                self._configs = new_configs
                self._plan_order = new_order

        if setting_rows:
            for row in setting_rows:
                self._scalars[row["key"]] = row["value"]

        # PLAN_CREDIT_LIMITS in-place 업데이트 (기존 참조 유지)
        PLAN_CREDIT_LIMITS.clear()
        PLAN_CREDIT_LIMITS.update(
            {p.value: c.credit_limit for p, c in self._configs.items() if c.credit_limit > 0}
        )

        # PLAN_ORDER in-place 업데이트
        PLAN_ORDER.clear()
        PLAN_ORDER.update(self._plan_order)

        # PLAN_CONFIGS in-place 업데이트
        PLAN_CONFIGS.clear()
        PLAN_CONFIGS.update(self._configs)

        self._last_loaded = time.time()

    def invalidate(self) -> None:
        """캐시 강제 만료."""
        self._last_loaded = 0.0


# ── 모듈 레벨 dict (기존 import 호환) ──

PLAN_CONFIGS: dict[PlanType, PlanConfig] = dict(_DEFAULT_PLAN_CONFIGS)
PLAN_ORDER: dict[PlanType, int] = dict(_DEFAULT_PLAN_ORDER)
PLAN_CREDIT_LIMITS: dict[str, int] = {
    p.value: c.credit_limit for p, c in _DEFAULT_PLAN_CONFIGS.items() if c.credit_limit > 0
}


# ── 공개 API (기존 시그니처 유지) ──

def get_plan_config(plan: PlanType | str) -> PlanConfig:
    """플랜 설정 조회. 미등록 플랜이면 Free 반환."""
    cache = _PlanConfigCache.get()
    configs = cache._configs
    if isinstance(plan, str):
        try:
            plan = PlanType(plan)
        except ValueError:
            return configs[PlanType.FREE]
    return configs.get(plan, configs[PlanType.FREE])


def get_credit_limit(plan: PlanType | str) -> int:
    """플랜별 크레딧 한도 조회."""
    return get_plan_config(plan).credit_limit


def is_feature_allowed(plan: PlanType | str, feature: str) -> bool:
    """플랜에서 특정 기능 사용 가능 여부."""
    return feature in get_plan_config(plan).features


def is_upgrade(current: PlanType | str, target: PlanType | str) -> bool:
    """target이 current보다 상위 플랜인지 판단."""
    if isinstance(current, str):
        current = PlanType(current)
    if isinstance(target, str):
        target = PlanType(target)
    return PLAN_ORDER.get(target, 0) > PLAN_ORDER.get(current, 0)


def is_downgrade(current: PlanType | str, target: PlanType | str) -> bool:
    """target이 current보다 하위 플랜인지 판단."""
    if isinstance(current, str):
        current = PlanType(current)
    if isinstance(target, str):
        target = PlanType(target)
    return PLAN_ORDER.get(target, 0) < PLAN_ORDER.get(current, 0)


# ── 스칼라 설정 getter ──

def get_trial_duration_days() -> int:
    """체험 기본 기간 (일)."""
    return int(_PlanConfigCache.get()._scalars.get("trial_duration_days", "365"))


def get_trial_plan() -> PlanType:
    """체험 시 부여 플랜."""
    val = _PlanConfigCache.get()._scalars.get("trial_plan", "pro")
    try:
        return PlanType(val)
    except ValueError:
        return PlanType.PRO


def get_credit_cycle_days() -> int:
    """크레딧 갱신 주기 (일)."""
    return int(_PlanConfigCache.get()._scalars.get("credit_cycle_days", "30"))


def get_quota_grace_days() -> int:
    """쿼터 초과 유예 기간 (일)."""
    return int(_PlanConfigCache.get()._scalars.get("quota_grace_days", "7"))


# ── DB → 캐시 로딩 (앱 시작 + lazy refresh) ──

async def refresh_plan_config_cache(session: AsyncSession) -> None:
    """DB에서 설정을 읽어 캐시를 갱신."""
    from sqlalchemy import text

    cache = _PlanConfigCache.get()
    if not cache.is_stale:
        return

    try:
        # platform_settings
        result = await session.execute(
            text("SELECT key, value FROM platform_settings WHERE deleted_at IS NULL")
        )
        setting_rows = [{"key": r[0], "value": r[1]} for r in result.fetchall()]

        # plan_configs (메타데이터 포함)
        result = await session.execute(
            text(
                "SELECT plan_type, label, price_monthly, credit_limit, features, plan_order, "
                "tagline, audience, is_recommended, base_features, additions, base_plan, "
                "badge_bg, badge_text, feature_labels, feature_descriptions "
                "FROM plan_configs WHERE deleted_at IS NULL AND is_active = true "
                "ORDER BY plan_order"
            )
        )
        plan_rows = [
            {
                "plan_type": r[0],
                "label": r[1],
                "price_monthly": r[2],
                "credit_limit": r[3],
                "features": r[4],
                "plan_order": r[5],
                "tagline": r[6],
                "audience": r[7],
                "is_recommended": r[8],
                "base_features": r[9],
                "additions": r[10],
                "base_plan": r[11],
                "badge_bg": r[12],
                "badge_text": r[13],
                "feature_labels": r[14],
                "feature_descriptions": r[15],
            }
            for r in result.fetchall()
        ]

        cache.update(plan_rows, setting_rows)
    except Exception:
        # DB 미연결 시 폴백 값 유지 (에러 로깅은 호출자 책임)
        pass


def invalidate_plan_config_cache() -> None:
    # 설정 변경 표면(platform_admin)이 캐시를 무효화하는 공개 진입점 — 내부 캐시는 비노출.
    _PlanConfigCache.get().invalidate()
