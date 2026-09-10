from app.core.schemas import MessageResponse
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade import MessageTemplateFacade


async def delete_message_template_handler(
    *,
    event_group_id: uuid_str,
    center_id: str | None,
    template_id: str,
    uow: UnitOfWork,
    actor_id: str | None,
    actor_type: str = "member",
) -> MessageResponse:
    facade = MessageTemplateFacade(uow)
    atomic, _ = await facade.delete_template(center_id, template_id)
    await emit(
        uow,
        "message_template_deleted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
        actor_type=actor_type,
    )
    return MessageResponse(message="삭제되었습니다.")


TOOL = {
    "name": "delete_message_template_handler",
    "permission": None,
    "purpose": "메시지 템플릿을 삭제한다.",
    "keywords": ["메시지 템플릿 삭제", "문자 양식 삭제", "template 삭제"],
    "boundaries": "메시지 템플릿 삭제. 조회는 get_message_template_handler.",
    "output": "삭제 결과 메시지 (MessageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "삭제할 메시지 템플릿의 UUID."},
        },
        "required": ["template_id"],
    },
}
