# field_note 모듈의 프로덕션 프롬프트를 fallback으로 주입해 PromptFacade가 import (크로스 모듈).
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.ai_lab.facade import PromptFacade
from app.modules.ai_lab.prompt_version.schemas import PromptVersionResponse
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic

from app.runtime.field_note.prompts import get_production_prompts


async def import_production_prompts_handler(
    module: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> list[PromptVersionResponse]:
    module_prompts = (
        get_production_prompts() if module == "field_note" else None
    )
    imported = await PromptFacade(uow).import_production_prompts(
        module=module,
        module_prompts=module_prompts,
    )
    for prompt in imported:
        await emit(
            uow,
            "prompt_version_created",
            event_group_id=event_group_id,
            atomics=[AdminAuditAtomic(
                _act="created",
                _entity_name="prompt_version",
                _entity_id=prompt.id,
                _payload={"data": {
                    "source": "production_import",
                    "module": module,
                }},
            )],
            actor_id=actor_id,
            actor_type="admin",
            ip_address=ip,
        )
    for p in imported:
        await uow.session.refresh(p)
    return [PromptVersionResponse.model_validate(p) for p in imported]


TOOL = {
    "name": "import_production_prompts_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "운영 중인 프로덕션 프롬프트를 AI Lab으로 가져와 실험용 프롬프트 버전으로 등록한다.",
    "keywords": [
        "import production prompts",
        "프로덕션 프롬프트 가져오기",
        "프롬프트 import",
        "운영 프롬프트 복사",
        "프롬프트 시드",
        "lab 프롬프트 주입",
        "기본 프롬프트 불러오기",
        "프롬프트 초기화",
    ],
    "boundaries": "현재 운영(프로덕션) 중인 프롬프트를 실험실로 fallback 주입하는 운영자용 도구다. 필드노트 오디오 샘플을 가져오는 import_field_note_sample_handler나 후보 조회 list_field_note_candidates_handler와는 다르다.",
    "output": "가져온 실험용 프롬프트 버전 목록 (PromptVersionResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "module": {
                "type": "string",
                "title": "대상 모듈",
                "description": "프롬프트를 가져올 대상 모듈 이름 (예: field_note).",
            },
        },
        "required": ["module"],
    },
}
