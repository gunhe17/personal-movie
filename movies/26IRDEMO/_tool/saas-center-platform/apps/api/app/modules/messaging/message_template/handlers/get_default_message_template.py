from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import DefaultTemplateResponse
from ...facade import MessageTemplateFacade


async def get_default_message_template_handler(
    center_id: str,
    template_type: str,
    uow: UnitOfWork,
) -> DefaultTemplateResponse:
    facade = MessageTemplateFacade(uow)
    result = await facade.get_default_template_with_response(center_id, template_type)
    return result


TOOL = {
    "name": "get_default_message_template_handler",
    "permission": None,
    "purpose": "특정 유형의 기본 메시지 템플릿을 조회한다.",
    "keywords": ["기본 템플릿", "디폴트 양식", "default template"],
    "boundaries": "유형별 '기본' 메시지 템플릿 조회(읽기). 기본 지정은 set_default_message_template_handler.",
    "output": "유형별 기본 메시지 템플릿 (DefaultTemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_type": {
                "type": "string",
                "title": "메시지 유형",
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
                "description": "기본 템플릿을 조회할 메시지 유형.",
            },
        },
        "required": ["template_type"],
    },
}
