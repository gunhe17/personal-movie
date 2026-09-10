from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import PromptFacade
from ..schemas import PromptVersionResponse


async def get_prompt_handler(
    prompt_id: str,
    uow: UnitOfWork,
) -> PromptVersionResponse:
    prompt = await PromptFacade(uow).find_prompt(prompt_id)
    if not prompt:
        raise EntityNotFoundException(f"Prompt not found: {prompt_id}")
    return PromptVersionResponse.model_validate(prompt)


TOOL = {
    "name": "get_prompt_handler",
    "permission": None,
    "purpose": "AI 프롬프트 버전 한 건을 조회한다.",
    "keywords": ["프롬프트 조회", "prompt 상세", "프롬프트 버전 정보"],
    "boundaries": "단건 프롬프트 조회(읽기 전용). 목록은 list_prompts_handler.",
    "output": "프롬프트 버전 상세 (PromptVersionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "prompt_id": {"type": "string", "format": "uuid", "title": "대상 프롬프트", "description": "조회할 프롬프트 버전의 UUID."},
        },
        "required": ["prompt_id"],
    },
}
