from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import ExperimentFacade
from ..schemas import PromptSuggestionResponse
from app.modules.llm.facade.ai_facade import create_ai_facade


async def generate_prompt_suggestion_handler(
    experiment_id: str,
    model: str,
    uow: UnitOfWork,
) -> PromptSuggestionResponse:
    return await ExperimentFacade(uow, create_ai_facade()).generate_prompt_suggestion(
        experiment_id, model=model
    )


TOOL = {
    "name": "generate_prompt_suggestion_handler",
    "permission": None,
    "purpose": "실험 결과를 바탕으로 개선된 프롬프트를 AI에게 제안받는다.",
    "keywords": ["프롬프트 제안", "prompt 개선", "프롬프트 추천", "개선안 받기"],
    "boundaries": "실험 기반 프롬프트 '개선안' 생성(읽기성). 프롬프트 저장은 prompt_version/create_prompt_handler.",
    "output": "AI가 제안한 개선 프롬프트 (PromptSuggestionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "experiment_id": {"type": "string", "format": "uuid", "title": "기준 실험", "description": "개선 기준이 될 실험의 UUID."},
            "model": {"type": "string", "title": "제안 모델", "description": "제안 생성에 사용할 모델."},
        },
        "required": ["experiment_id", "model"],
    },
}
