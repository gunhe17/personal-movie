from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ...facade import PromptFacade
from ..schemas import PromptVersionResponse


async def list_prompts_handler(
    prompt_key: str | None,
    uow: UnitOfWork,
) -> list[PromptVersionResponse]:
    items = await PromptFacade(uow).list_prompts(prompt_key)
    return [PromptVersionResponse.model_validate(p) for p in items]


TOOL = {
    "name": "list_prompts_handler",
    "permission": None,
    "purpose": "AI 프롬프트 버전 목록을 조회한다.",
    "keywords": ["프롬프트 목록", "prompt 리스트", "프롬프트 버전 목록"],
    "boundaries": "프롬프트 목록(읽기 전용, 키로 필터). 단건은 get_prompt_handler.",
    "output": "프롬프트 버전 목록 (PromptVersionResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "prompt_key": {"type": "string", "title": "프롬프트 키 필터", "description": "프롬프트 키 필터(선택)."},
        },
        "required": [],
    },
}
