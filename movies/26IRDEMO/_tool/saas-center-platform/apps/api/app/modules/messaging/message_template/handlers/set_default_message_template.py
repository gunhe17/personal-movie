from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import MessageTemplateResponse
from ...facade import MessageTemplateFacade


async def set_default_message_template_handler(
    center_id: str | None,
    template_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> MessageTemplateResponse:
    facade = MessageTemplateFacade(uow)
    atomic, template = await facade.set_default(center_id, template_id)
    await emit(
        uow,
        "message_template_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return MessageTemplateResponse.model_validate(template)


TOOL = {
    "name": "set_default_message_template_handler",
    "permission": None,
    "purpose": "메시지 템플릿을 해당 유형의 기본으로 지정한다.",
    "keywords": ["기본 템플릿 지정", "디폴트 설정", "set default"],
    "boundaries": "메시지 템플릿을 '기본'으로 지정. 기본 조회는 get_default_message_template_handler.",
    "output": "기본으로 지정된 메시지 템플릿 (MessageTemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "기본으로 지정할 메시지 템플릿의 UUID."},
        },
        "required": ["template_id"],
    },
}
