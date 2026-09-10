from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateResponse


async def set_form_template_status_handler(
    template_id: str,
    center_id: str,
    is_active: bool,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> TemplateResponse:
    facade = FormTemplateFacade(uow)
    if is_active:
        atomic, template = await facade.reactivate_template(
            template_id=template_id,
            center_id=center_id,
        )
        event_name = "form_template_reactivated"
    else:
        atomic, template = await facade.deactivate_template(
            template_id=template_id,
            center_id=center_id,
        )
        event_name = "form_template_deactivated"

    await emit(
        uow,
        event_name,
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return TemplateResponse.model_validate(template)


TOOL = {
    "name": "set_form_template_status_handler",
    "permission": "write:form_template",
    "purpose": "폼 템플릿의 활성 상태를 설정한다.",
    "keywords": ['set template status', "템플릿 상태", "양식 활성화", "set status"],
    "boundaries": "템플릿 활성/비활성 토글. 비활성화 전용은 deactivate_form_template_handler.",
    "output": "상태가 변경된 폼 템플릿 (TemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "상태를 바꿀 템플릿의 UUID."},
            "is_active": {"type": "boolean", "title": "활성 여부", "description": "true면 활성, false면 비활성."},
        },
        "required": ["template_id", "is_active"],
    },
}
