import json

from app.core.type import unset
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.plan_config.models import PlanConfig
from app.modules.platform_admin.plan_config.repository import PlanConfigRepository

# TEXT 컬럼에 JSON 직렬화로 저장되는 필드
_JSON_FIELDS = {"features", "base_features", "additions", "feature_labels", "feature_descriptions"}


class UpdatePlanConfigService:
    def __init__(
        self,
        repo: PlanConfigRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        plan_type: str,
        label: str = unset,
        price_monthly: int = unset,
        credit_limit: int = unset,
        features: list[str] = unset,
        plan_order: int = unset,
        is_active: bool = unset,
        tagline: str | None = unset,
        audience: str | None = unset,
        is_recommended: bool = unset,
        base_features: list[str] | None = unset,
        additions: list[str] | None = unset,
        base_plan: str | None = unset,
        badge_bg: str | None = unset,
        badge_text: str | None = unset,
        feature_labels: dict[str, str] | None = unset,
        feature_descriptions: dict[str, str] | None = unset,
    ) -> tuple[AdminAuditAtomic, PlanConfig]:
        # verify
        await self.repo.get_by_plan_type(plan_type=plan_type)

        # compute
        updates = {
            k: v
            for k, v in {
                "label": label,
                "price_monthly": price_monthly,
                "credit_limit": credit_limit,
                "features": features,
                "plan_order": plan_order,
                "is_active": is_active,
                "tagline": tagline,
                "audience": audience,
                "is_recommended": is_recommended,
                "base_features": base_features,
                "additions": additions,
                "base_plan": base_plan,
                "badge_bg": badge_bg,
                "badge_text": badge_text,
                "feature_labels": feature_labels,
                "feature_descriptions": feature_descriptions,
            }.items()
            if v is not unset
        }
        values = {
            field: json.dumps(value, ensure_ascii=False) if field in _JSON_FIELDS else value
            for field, value in updates.items()
        }

        # return
        row = await self.repo.update_by_plan_type(plan_type=plan_type, **values)
        atomic = AdminAuditAtomic(
            _act="updated",
            _entity_name="plan_config",
            _entity_id=plan_type,
            _payload={"data": {"plan_type": plan_type, **updates}},
        )
        return atomic, row
