from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import MessageTemplateListResponse
from ...facade import MessageTemplateFacade


async def list_message_templates_handler(
    center_id: str,
    uow: UnitOfWork,
    template_type: str | None = None,
) -> MessageTemplateListResponse:
    facade = MessageTemplateFacade(uow)
    result = await facade.list_templates_with_response(center_id, template_type)
    return result


TOOL = {
    "name": "list_message_templates_handler",
    "permission": None,
    "purpose": "메시지 템플릿 목록을 유형으로 거르고 조회한다.",
    "keywords": ["메시지 템플릿 목록", "문자 양식 목록", "template 리스트"],
    "boundaries": "메시지 템플릿 목록(읽기). 단건은 get_message_template_handler.",
    "output": "메시지 템플릿 목록 (MessageTemplateListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_type": {
                "type": "string",
                "title": "유형 필터",
                "enum": [
                    "assessment_result_send",
                    "assessment_send_link",
                    "assessment_report_ready",
                    "counseling_session_booked",
                    "session_reminder",
                    "appointment_confirmation_sms",
                    "invoice_issued",
                    "form_fill_request",
                ],
                "description": "메시지 유형 필터(선택).",
            },
        },
        "required": [],
    },
}
