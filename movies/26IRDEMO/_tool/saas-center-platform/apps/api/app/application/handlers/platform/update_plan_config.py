import json
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.plan_config.facade import PlanConfigFacade
from app.modules.platform_admin.platform_settings.schemas import (
    PlanConfigResponse,
    PlanConfigUpdate,
)
from app.modules.subscription.subscription.plan_config import (
    invalidate_plan_config_cache,
)


async def update_plan_config_handler(
    *,
    plan_type: str,
    data: PlanConfigUpdate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> PlanConfigResponse:
    # None 필드 드롭 → service unset 기본값 적용(기존 exclude_none 동작 유지)
    atomic, row = await PlanConfigFacade(uow).update_plan_config(
        plan_type,
        **data.model_dump(exclude_none=True),
    )

    await emit(
        uow,
        "plan_config_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    # 캐시 즉시 무효화
    invalidate_plan_config_cache()

    return PlanConfigResponse(
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


TOOL = {
    "name": "update_plan_config_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "특정 요금제 구성을 수정한다.",
    "keywords": ["요금제 설정 변경", "플랜 구성 수정", "plan config 변경"],
    "boundaries": "운영자 전용 — 요금제 구성 수정. 조회는 get_plan_configs_handler.",
    "output": "수정된 요금제 구성 (PlanConfigResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "plan_type": {
                "type": "string",
                "title": "요금제 종류",
                "description": "수정할 요금제 종류(플랜 식별자).",
            },
            "label": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "표시 이름",
                "description": "요금제 표시 이름(미지정 시 유지).",
            },
            "price_monthly": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "월 요금",
                "description": "월 요금(원, 미지정 시 유지).",
            },
            "credit_limit": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "크레딧 한도",
                "description": "월 크레딧 한도(미지정 시 유지).",
            },
            "features": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "기능 목록",
                "description": "제공 기능 목록(미지정 시 유지).",
            },
            "plan_order": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "노출 순서",
                "description": "요금제 노출 순서(미지정 시 유지).",
            },
            "is_active": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "title": "활성 여부",
                "description": "판매 활성 여부(미지정 시 유지).",
            },
            "tagline": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "태그라인",
                "description": "요금제 태그라인(미지정 시 유지).",
            },
            "audience": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "대상 고객",
                "description": "추천 대상 고객(미지정 시 유지).",
            },
            "is_recommended": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "title": "추천 여부",
                "description": "추천 요금제 표시 여부(미지정 시 유지).",
            },
            "base_features": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "기본 기능",
                "description": "기본 제공 기능 목록(미지정 시 유지).",
            },
            "additions": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "추가 기능",
                "description": "추가 기능 목록(미지정 시 유지).",
            },
            "base_plan": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "기준 요금제",
                "description": '"~에 더해" 표기용 기준 요금제(미지정 시 유지).',
            },
            "badge_bg": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "뱃지 배경색",
                "description": "뱃지 배경 색상(미지정 시 유지).",
            },
            "badge_text": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "뱃지 문구",
                "description": "뱃지 텍스트(미지정 시 유지).",
            },
            "feature_labels": {
                "anyOf": [
                    {"additionalProperties": {"type": "string"}, "type": "object"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "기능 라벨",
                "description": "기능 키→라벨 매핑(미지정 시 유지).",
            },
            "feature_descriptions": {
                "anyOf": [
                    {"additionalProperties": {"type": "string"}, "type": "object"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "기능 설명",
                "description": "기능 키→설명 매핑(미지정 시 유지).",
            },
        },
        "required": ["plan_type"],
    },
}
