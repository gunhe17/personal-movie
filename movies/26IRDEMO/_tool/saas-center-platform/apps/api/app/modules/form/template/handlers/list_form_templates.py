from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateListResponse


async def list_form_templates_handler(
    center_id: str,
    uow: UnitOfWork,
    include_system: bool = True,
    include_inactive: bool = False,
) -> TemplateListResponse:
    facade = FormTemplateFacade(uow)
    response = await facade.list_templates_with_response(
        center_id=center_id,
        include_system=include_system,
        include_inactive=include_inactive,
    )
    return response


TOOL = {
    "name": "list_form_templates_handler",
    "permission": "read:form_template",
    "purpose": "폼 템플릿 목록을 조회한다.",
    "keywords": ["템플릿 목록", "양식 목록", "template 리스트"],
    "boundaries": "폼 템플릿 목록(읽기). 단건은 get_form_template_handler.",
    "output": "폼 템플릿 목록 (TemplateListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "include_system": {
                "type": "boolean",
                "title": "시스템 포함",
                "description": "시스템 기본 템플릿 포함 여부(기본 true).",
            },
            "include_inactive": {
                "type": "boolean",
                "title": "비활성 포함",
                "description": "비활성 템플릿 포함 여부(기본 false — 활성만).",
            },
        },
        "required": [],
    },
}
