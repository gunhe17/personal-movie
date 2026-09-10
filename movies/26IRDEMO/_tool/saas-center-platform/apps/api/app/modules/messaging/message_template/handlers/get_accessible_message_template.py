from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import MessageTemplateResponse
from ...facade import MessageTemplateFacade


async def get_accessible_message_template_handler(
    center_id: str,
    template_id: str,
    uow: UnitOfWork,
) -> MessageTemplateResponse:
    facade = MessageTemplateFacade(uow)
    return await facade.get_accessible_template_with_response(
        center_id, template_id
    )


TOOL = {
    "name": "get_accessible_message_template_handler",
    "permission": None,
    "purpose": "접근 가능한 메시지 템플릿을 조회한다.",
    "keywords": ["접근 가능 템플릿", "사용 가능 양식", "accessible template"],
    "boundaries": "센터가 쓸 수 있는 메시지 템플릿 조회(읽기). 기본 템플릿은 get_default_message_template_handler.",
    "output": "접근 가능한 메시지 템플릿 (MessageTemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "조회할 메시지 템플릿의 UUID."},
        },
        "required": ["template_id"],
    },
}
