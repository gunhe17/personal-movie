from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import PromptFacade
from ..schemas import PromptVersionResponse, PromptVersionUpdate


async def update_prompt_handler(
    prompt_id: str,
    data: PromptVersionUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> PromptVersionResponse:
    result = await PromptFacade(uow).update_prompt(
        prompt_id, data.model_dump(exclude_unset=True)
    )
    if not result:
        raise EntityNotFoundException(f"Prompt not found: {prompt_id}")
    await emit_admin_audit(
        uow, "prompt_version_updated",
        act="updated", entity_name="prompt_version", entity_id=prompt_id,
        payload={"input": data.model_dump(mode="json", exclude_unset=True)},
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return PromptVersionResponse.model_validate(result)


TOOL = {
    "name": 'update_prompt_handler',
    "permission": None,
    "purpose": 'AI 프롬프트 버전을 수정한다.',
    "keywords": ['프롬프트 수정', 'prompt 편집', '프롬프트 버전 변경'],
    "boundaries": '프롬프트 버전 수정. 생성은 create_prompt_handler.',
    "output": '수정된 프롬프트 버전 (PromptVersionResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'prompt_id': {'type': 'string', 'format': 'uuid', 'title': '대상 프롬프트', 'description': '수정할 프롬프트 버전의 UUID.'},
            'name': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '이름', 'description': '프롬프트 이름(미지정 시 유지).'},
            'system_prompt': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시스템 프롬프트', 'description': '시스템 프롬프트(미지정 시 유지).'},
            'user_prompt_template': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '유저 프롬프트 템플릿', 'description': '유저 프롬프트 템플릿(미지정 시 유지).'},
            'is_active': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'title': '활성 여부', 'description': '활성 여부(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '프롬프트 설명(미지정 시 유지).'},
        },
        "required": ['prompt_id'],
    },
}
