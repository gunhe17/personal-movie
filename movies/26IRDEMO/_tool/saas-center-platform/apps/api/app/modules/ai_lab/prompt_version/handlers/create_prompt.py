from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import PromptFacade
from ..schemas import PromptVersionCreate, PromptVersionResponse


async def create_prompt_handler(
    data: PromptVersionCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> PromptVersionResponse:
    result = await PromptFacade(uow).create_prompt(**data.model_dump())
    await emit_admin_audit(
        uow, "prompt_version_created",
        act="created", entity_name="prompt_version", entity_id=result.id,
        payload={"prompt_key": data.prompt_key, "name": data.name},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return PromptVersionResponse.model_validate(result)


TOOL = {
    "name": 'create_prompt_handler',
    "permission": None,
    "purpose": 'AI 프롬프트 버전을 생성한다.',
    "keywords": ['프롬프트 생성', 'prompt 추가', '프롬프트 버전 등록', 'prompt 만들기'],
    "boundaries": '새 프롬프트 버전 생성. 수정은 update_prompt_handler, 운영 반영은 production_config/promote_to_production_handler.',
    "output": '생성된 프롬프트 버전 (PromptVersionResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'prompt_key': {'title': '프롬프트 키', 'type': 'string', 'description': '프롬프트 식별 키(용도 구분).'},
            'name': {'title': '이름', 'type': 'string', 'description': '프롬프트 버전 이름.'},
            'system_prompt': {'title': '시스템 프롬프트', 'type': 'string', 'description': '시스템 프롬프트 본문.'},
            'user_prompt_template': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '유저 프롬프트 템플릿', 'description': '유저 프롬프트 템플릿(선택).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '프롬프트 설명(선택).'},
        },
        "required": ['prompt_key', 'name', 'system_prompt'],
    },
}
