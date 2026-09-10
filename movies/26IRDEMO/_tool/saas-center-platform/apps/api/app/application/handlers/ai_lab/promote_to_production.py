import json

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

from app.modules.ai_lab.facade import ProductionConfigFacade
from app.modules.ai_lab.production_config.schemas import (
    ProductionAIConfigResponse,
    PromoteToProductionRequest,
)


async def promote_to_production_handler(
    *,
    data: PromoteToProductionRequest,
    uow: UnitOfWork,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None,
) -> ProductionAIConfigResponse:
    config = await ProductionConfigFacade(uow).promote_to_production(
        module=data.module,
        pipeline_step=data.pipeline_step,
        model_name=data.model_name,
        provider=data.provider,
        system_prompt=data.system_prompt,
        user_prompt_template=data.user_prompt_template,
        model_params=json.dumps(data.model_params) if data.model_params else None,
        promoted_from_version_id=data.prompt_version_id,
        description=data.description,
        diarization_strategy=data.diarization_strategy,
    )
    await emit(
        uow,
        "production_config_promoted",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="promoted",
                _entity_name="production_ai_config",
                _entity_id=config.id,
                _payload={
                    "data": {
                        "id": config.id,
                        "module": data.module,
                        "pipeline_step": data.pipeline_step,
                        "model_name": data.model_name,
                    }
                },
            )
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    return ProductionAIConfigResponse.model_validate(config)


TOOL = {
    "name": "promote_to_production_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "실험 설정을 프로덕션(운영)에 승격 적용한다.",
    "keywords": [
        "프로덕션 승격",
        "운영 적용",
        "promote",
        "실험 운영 반영",
        "설정 배포",
    ],
    "boundaries": "운영자 전용 — 실험 결과(프롬프트/모델 설정)를 '운영'에 반영한다. 현재 운영 설정 조회는 list_production_configs_handler.",
    "output": "운영에 승격된 프로덕션 AI 설정 (ProductionAIConfigResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "module": {
                "default": "field_note",
                "title": "모듈",
                "type": "string",
                "description": "설정을 적용할 모듈(기본 field_note).",
            },
            "pipeline_step": {
                "title": "파이프라인 단계",
                "type": "string",
                "description": "적용할 파이프라인 단계.",
            },
            "prompt_version_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "프롬프트 버전",
                "description": "적용할 프롬프트 버전 UUID(선택).",
            },
            "model_name": {
                "title": "모델",
                "type": "string",
                "description": "운영에 적용할 모델명.",
            },
            "provider": {
                "default": "openai",
                "title": "제공자",
                "type": "string",
                "description": "모델 제공자(기본 openai).",
            },
            "system_prompt": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "시스템 프롬프트",
                "description": "시스템 프롬프트(선택).",
            },
            "user_prompt_template": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "유저 프롬프트 템플릿",
                "description": "유저 프롬프트 템플릿(선택).",
            },
            "model_params": {
                "anyOf": [
                    {"additionalProperties": True, "type": "object"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "모델 파라미터",
                "description": "모델 파라미터(선택).",
            },
            "description": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "설명",
                "description": "설정 설명(선택).",
            },
            "diarization_strategy": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "화자분리 전략",
                "description": "화자분리 전략(선택).",
            },
        },
        "required": ["pipeline_step", "model_name"],
    },
}
