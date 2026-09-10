"""플랜 설정(PlanConfig) + 플랫폼 스칼라 설정(PlatformSetting) 시드.

`subscription/plan_config.py` 의 하드코딩 폴백(`_DEFAULT_*`)을 DB 정본으로 승격한다.
이 테이블이 비어 있으면 `refresh_plan_config_cache()` 가 아무것도 못 읽어 폴백으로만 돌고,
플랜 한도(크레딧)를 운영에서 조정할 수 없다.
"""
import asyncio
import json
from uuid import uuid4

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.platform_admin.plan_config.models import PlanConfig
from app.modules.platform_admin.platform_setting.models import PlatformSetting
from app.modules.subscription.subscription.plan_config import (
    _DEFAULT_PLAN_CONFIGS,
    _DEFAULT_PLAN_ORDER,
    _DEFAULT_SCALARS,
)

SETTING_DESCRIPTIONS = {
    "trial_duration_days": "체험 기본 기간(일)",
    "trial_plan": "체험 시 부여 플랜",
    "credit_cycle_days": "크레딧 갱신 주기(일)",
    "quota_grace_days": "쿼터 초과 유예 기간(일)",
}


async def _seed_plans(session) -> None:
    for plan_type, config in _DEFAULT_PLAN_CONFIGS.items():
        existing = (await session.execute(
            select(PlanConfig).where(
                PlanConfig.plan_type == plan_type.value,
                PlanConfig.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if existing:
            print(f"  ⏭️  플랜 '{plan_type.value}' 이미 존재 (크레딧 {existing.credit_limit:,})")
            continue

        session.add(PlanConfig(
            id=str(uuid4()),
            plan_type=plan_type.value,
            label=config.label,
            price_monthly=config.price_monthly,
            credit_limit=config.credit_limit,
            plan_order=_DEFAULT_PLAN_ORDER[plan_type],
            is_active=True,
            is_recommended=config.is_recommended,
            features=json.dumps(sorted(config.features), ensure_ascii=False),
            tagline=config.tagline or None,
            audience=config.audience or None,
            base_plan=config.base_plan,
            badge_bg=config.badge_bg,
            badge_text=config.badge_text,
            base_features=json.dumps(list(config.base_features), ensure_ascii=False),
            additions=json.dumps(list(config.additions), ensure_ascii=False),
            feature_labels=json.dumps(config.feature_labels, ensure_ascii=False),
            feature_descriptions=json.dumps(config.feature_descriptions, ensure_ascii=False),
        ))
        print(f"  ✅ 플랜 '{plan_type.value}' ({config.label}, 크레딧 {config.credit_limit:,})")


async def _seed_settings(session) -> None:
    for key, value in _DEFAULT_SCALARS.items():
        existing = (await session.execute(
            select(PlatformSetting).where(
                PlatformSetting.key == key,
                PlatformSetting.deleted_at.is_(None),
            )
        )).scalar_one_or_none()
        if existing:
            print(f"  ⏭️  설정 '{key}' 이미 존재 ({existing.value})")
            continue
        session.add(PlatformSetting(
            id=str(uuid4()),
            key=key,
            value=value,
            description=SETTING_DESCRIPTIONS.get(key),
        ))
        print(f"  ✅ 설정 '{key}' = {value}")


async def main() -> None:
    print("📊 플랜 설정/플랫폼 설정 시드")
    async with AsyncSessionLocal() as session:
        await _seed_plans(session)
        await _seed_settings(session)
        await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
