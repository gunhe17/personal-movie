from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateResponse


async def get_form_template_handler(
    template_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> TemplateResponse:
    facade = FormTemplateFacade(uow)
    response = await facade.get_template_with_response(
        template_id=template_id,
        center_id=center_id,
    )
    return response


TOOL = {
    "name": "get_form_template_handler",
    "permission": "read:form_template",
    "purpose": "폼 템플릿 한 건을 조회한다.",
    "keywords": ["템플릿 조회", "양식 상세", "template 조회"],
    "boundaries": "단건 템플릿 조회(읽기). 목록은 list_form_templates_handler.",
    "output": "폼 템플릿 상세 (TemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 템플릿",
                "description": "조회할 템플릿의 UUID.",
            },
        },
        "required": ["template_id"],
    },
}
