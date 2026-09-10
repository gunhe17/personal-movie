import json
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.plan_config.repository import PlanConfigRepository
from app.modules.platform_admin.platform_settings.schemas import (
    PlanConfigListResponse,
    PlanConfigResponse,
)


async def get_plan_configs_handler(
    uow: UnitOfWork,
) -> PlanConfigListResponse:
    repo = uow.repo(PlanConfigRepository)
    rows = await repo.list_active()

    items = [
        PlanConfigResponse(
            id=row.id,
            plan_type=row.plan_type,
            label=row.label,
            price_monthly=row.price_monthly,
            credit_limit=row.credit_limit,
            features=json.loads(row.features)
            if isinstance(row.features, str)
            else row.features,
            plan_order=row.plan_order,
            is_active=row.is_active,
            tagline=row.tagline,
            audience=row.audience,
            is_recommended=row.is_recommended,
            base_features=json.loads(row.base_features)
            if isinstance(row.base_features, str) and row.base_features
            else [],
            additions=json.loads(row.additions)
            if isinstance(row.additions, str) and row.additions
            else [],
            base_plan=row.base_plan,
            badge_bg=row.badge_bg,
            badge_text=row.badge_text,
            feature_labels=json.loads(row.feature_labels)
            if isinstance(row.feature_labels, str) and row.feature_labels
            else {},
            feature_descriptions=json.loads(row.feature_descriptions)
            if isinstance(row.feature_descriptions, str) and row.feature_descriptions
            else {},
        )
        for row in rows
    ]
    return PlanConfigListResponse(items=items)


TOOL = {
    "name": "get_plan_configs_handler",
    "permission": None,
    "purpose": "요금제 구성(플랜 설정) 목록을 조회한다.",
    "keywords": ["요금제 설정 조회", "플랜 구성", "plan config 목록"],
    "boundaries": "운영자 전용 — 요금제 구성 목록(읽기). 변경은 update_plan_config_handler.",
    "output": "요금제 구성 목록 (PlanConfigListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
