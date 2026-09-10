from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import MessageTemplateCreate, MessageTemplateResponse
from ...facade import MessageTemplateFacade


async def create_message_template_handler(
    *,
    event_group_id: uuid_str,
    center_id: str | None,
    data: MessageTemplateCreate,
    uow: UnitOfWork,
    actor_id: str | None,
    actor_type: str = "member",
) -> MessageTemplateResponse:
    facade = MessageTemplateFacade(uow)
    atomic, template = await facade.create_template(
        center_id=center_id,
        template_type=data.template_type.value,
        name=data.name,
        content=data.content,
        is_default=data.is_default,
    )
    await emit(
        uow,
        "message_template_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
        actor_type=actor_type,
    )
    return MessageTemplateResponse.model_validate(template)


TOOL = {
    "name": 'create_message_template_handler',
    "permission": None,
    "purpose": '메시지(알림톡·문자) 템플릿을 생성한다.',
    "keywords": ['메시지 템플릿 생성', '문자 양식', '알림톡 템플릿', 'message template 생성'],
    "boundaries": '메시지 템플릿 생성. 수정은 update_message_template_handler, 기본 지정은 set_default_message_template_handler.',
    "output": '생성된 메시지 템플릿 (MessageTemplateResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_type': {'$ref': '#/$defs/TemplateType', 'description': '템플릿 용도 타입(검사결과 발송·예약 확인 등).'},
            'name': {'maxLength': 100, 'title': '템플릿 이름', 'type': 'string', 'description': '템플릿 이름.'},
            'content': {'minLength': 1, 'title': '본문', 'type': 'string', 'description': '메시지 본문(치환 변수 포함 가능).'},
            'is_default': {'default': False, 'title': '기본 지정', 'type': 'boolean', 'description': 'true면 해당 타입의 기본 템플릿으로 지정.'},
        },
        "$defs": {'TemplateType': {'description': '문자 양식 타입', 'enum': ['assessment_result_send', 'assessment_send_link', 'assessment_report_ready', 'counseling_session_booked', 'session_reminder', 'appointment_confirmation_sms', 'invoice_issued', 'form_fill_request'], 'title': 'TemplateType', 'type': 'string'}},
        "required": ['template_type', 'name', 'content'],
    },
}
