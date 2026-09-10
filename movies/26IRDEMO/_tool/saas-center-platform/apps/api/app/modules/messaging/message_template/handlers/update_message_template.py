from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import MessageTemplateUpdate, MessageTemplateResponse
from ...facade import MessageTemplateFacade


async def update_message_template_handler(
    *,
    event_group_id: uuid_str,
    center_id: str | None,
    template_id: str,
    data: MessageTemplateUpdate,
    uow: UnitOfWork,
    actor_id: str | None,
    actor_type: str = "member",
) -> MessageTemplateResponse:
    facade = MessageTemplateFacade(uow)
    atomic, template = await facade.update_template(
        center_id=center_id,
        template_id=template_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        name=data.name,
        content=data.content,
    )
    await emit(
        uow,
        "message_template_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
        actor_type=actor_type,
    )
    return MessageTemplateResponse.model_validate(template)


TOOL = {
    "name": 'update_message_template_handler',
    "permission": None,
    "purpose": '메시지 템플릿을 수정한다.',
    "keywords": ['메시지 템플릿 수정', '문자 양식 편집', 'template 수정'],
    "boundaries": '메시지 템플릿 수정. 생성은 create_message_template_handler.',
    "output": '수정된 메시지 템플릿 (MessageTemplateResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_id': {'type': 'string', 'format': 'uuid', 'title': '대상 템플릿', 'description': '수정할 메시지 템플릿의 UUID.'},
            'name': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '템플릿 이름', 'description': '템플릿 이름(미지정 시 유지).'},
            'content': {'anyOf': [{'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '본문', 'description': '메시지 본문(미지정 시 유지).'},
        },
        "required": ['template_id'],
    },
}
