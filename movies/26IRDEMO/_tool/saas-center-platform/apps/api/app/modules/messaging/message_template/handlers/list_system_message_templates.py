from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import MessageTemplateListResponse
from ...facade import MessageTemplateFacade


async def list_system_message_templates_handler(
    uow: UnitOfWork,
    template_type: str | None = None,
) -> MessageTemplateListResponse:
    facade = MessageTemplateFacade(uow)
    result = await facade.list_system_templates_with_response(template_type)
    return result


TOOL = {
    "name": "list_system_message_templates_handler",
    "permission": None,
    "purpose": "플랫폼 기본(시스템) 메시지 템플릿 목록을 조회한다.",
    "keywords": [
        "시스템 템플릿 목록",
        "기본 메시지 양식",
        "system template",
        "공통 템플릿",
    ],
    "boundaries": "운영자용 — 센터 무관 '시스템' 메시지 템플릿 목록(읽기). 센터 템플릿 포함 목록은 list_message_templates_handler.",
    "output": "시스템 메시지 템플릿 목록 (MessageTemplateListResponse).",
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
