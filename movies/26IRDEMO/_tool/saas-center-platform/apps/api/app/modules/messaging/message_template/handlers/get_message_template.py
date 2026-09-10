from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import MessageTemplateResponse
from ...facade import MessageTemplateFacade


async def get_message_template_handler(
    center_id: str | None,
    template_id: str,
    uow: UnitOfWork,
) -> MessageTemplateResponse:
    facade = MessageTemplateFacade(uow)
    return await facade.get_template_with_response(center_id, template_id)


TOOL = {
    "name": "get_message_template_handler",
    "permission": None,
    "purpose": "메시지 템플릿 한 건을 조회한다.",
    "keywords": ["메시지 템플릿 조회", "문자 양식 상세", "template 조회"],
    "boundaries": "단건 메시지 템플릿 조회(읽기). 목록은 list_message_templates_handler.",
    "output": "메시지 템플릿 상세 (MessageTemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "조회할 메시지 템플릿의 UUID."},
        },
        "required": ["template_id"],
    },
}
