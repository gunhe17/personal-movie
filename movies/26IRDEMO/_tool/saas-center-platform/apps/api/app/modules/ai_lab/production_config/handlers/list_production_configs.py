from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ProductionConfigFacade
from ..schemas import ProductionAIConfigResponse


async def list_production_configs_handler(
    module: str | None,
    uow: UnitOfWork,
) -> list[ProductionAIConfigResponse]:
    configs = await ProductionConfigFacade(uow).list_production_configs(module=module)
    return [ProductionAIConfigResponse.model_validate(c) for c in configs]


TOOL = {
    "name": "list_production_configs_handler",
    "permission": None,
    "purpose": "현재 프로덕션에 적용된 AI 설정 목록을 조회한다.",
    "keywords": ["프로덕션 설정 목록", "운영 AI 설정", "production config 목록", "적용 설정 조회"],
    "boundaries": "운영(프로덕션) AI 설정 목록(읽기 전용). 실험 결과를 운영에 올리는 건 promote_to_production_handler.",
    "output": "프로덕션 AI 설정 목록 (ProductionAIConfigResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "module": {"type": "string", "title": "모듈 필터", "description": "모듈 필터(선택)."},
        },
        "required": [],
    },
}
