from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.template.repository import FormTemplateRepository
from app.modules.form.template.schemas import TemplateResponse
from app.modules.form.template.services.publish_template import PublishTemplateService


async def publish_form_template_handler(
    *,
    event_group_id: uuid_str,
    template_id: str,
    center_id: str,
    uow: UnitOfWork,
    actor_id: str,
) -> TemplateResponse:
    service = PublishTemplateService(uow.repo(FormTemplateRepository))
    atomic, template = await service.execute(
        template_id=template_id,
        center_id=center_id,
    )
    await emit(
        uow,
        "form_template_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return TemplateResponse.model_validate(template)


TOOL = {
    "name": "publish_form_template_handler",
    "permission": "write:form_template",
    "purpose": "폼 템플릿(버전)을 게시(공개)한다.",
    "keywords": ['publish template', "템플릿 게시", "양식 발행", "publish"],
    "boundaries": "템플릿 '게시'. 초안 수정은 update_form_template_draft_handler.",
    "output": "게시된 폼 템플릿 (TemplateResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "template_id": {"type": "string", "format": "uuid", "title": "대상 템플릿", "description": "게시할 템플릿의 UUID."},
        },
        "required": ["template_id"],
    },
}
