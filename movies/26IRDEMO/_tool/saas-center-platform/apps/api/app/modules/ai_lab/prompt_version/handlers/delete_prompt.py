from app.core.schemas import OkResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..._audit import emit_admin_audit
from ...facade import PromptFacade


async def delete_prompt_handler(
    prompt_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> OkResponse:
    await PromptFacade(uow).delete_prompt(prompt_id)
    await emit_admin_audit(
        uow, "prompt_version_deleted",
        act="deleted", entity_name="prompt_version", entity_id=prompt_id,
        event_group_id=event_group_id, actor_id=actor_id, ip=ip,
    )
    return OkResponse(ok=True)


TOOL = {
    "name": "delete_prompt_handler",
    "permission": None,
    "purpose": "AI 프롬프트 버전을 삭제한다.",
    "keywords": ["프롬프트 삭제", "prompt 삭제", "프롬프트 버전 제거"],
    "boundaries": "프롬프트 버전 삭제. 조회는 get_prompt_handler.",
    "output": "삭제 결과 (OkResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "prompt_id": {"type": "string", "format": "uuid", "title": "대상 프롬프트", "description": "삭제할 프롬프트 버전의 UUID."},
        },
        "required": ["prompt_id"],
    },
}
