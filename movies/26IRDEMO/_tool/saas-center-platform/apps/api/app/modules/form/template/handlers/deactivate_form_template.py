from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateResponse


async def deactivate_form_template_handler(
    template_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> TemplateResponse:
    facade = FormTemplateFacade(uow)
    atomic, template = await facade.deactivate_template(
        template_id=template_id,
        center_id=center_id,
    )
    await emit(
        uow,
        "form_template_deactivated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return TemplateResponse.model_validate(template)


TOOL = {
    "name": "deactivate_form_template_handler",
    "permission": "write:form_template",
    "purpose": "폼 템플릿을 비활성화한다.",
    "keywords": ['deactivate template', "템플릿 비활성화", "양식 끄기", "deactivate"],
    "boundaries": "폼 템플릿 비활성화. 상태 토글은 set_form_template_status_handler.",
    "output": "비활성화된 폼 템플릿 (TemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "비활성화할 템플릿의 UUID."},
        },
        "required": ["template_id"],
    },
}
