from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.template.repository import FormTemplateRepository
from app.modules.form.template.schemas import TemplateDraftUpdate, TemplateResponse
from app.modules.form.template.services.update_template_draft import (
    UpdateTemplateDraftService,
)


async def update_form_template_draft_handler(
    *,
    event_group_id: uuid_str,
    template_id: str,
    center_id: str,
    data: TemplateDraftUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> TemplateResponse:
    service = UpdateTemplateDraftService(uow.repo(FormTemplateRepository))
    atomic, template = await service.execute(
        template_id=template_id,
        center_id=center_id,
        schema=data.schema_,
        changed=data.model_dump(mode="json", exclude_unset=True),
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
    "name": 'update_form_template_draft_handler',
    "permission": "write:form_template",
    "purpose": '폼 템플릿의 초안을 수정한다.',
    "keywords": ['update template draft', '템플릿 초안 수정', '양식 편집', 'draft 수정'],
    "boundaries": "템플릿 '초안' 수정. 게시는 publish_form_template_handler.",
    "output": '수정된 초안 폼 템플릿 (TemplateResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_id': {'type': 'string', 'format': 'uuid', 'title': '대상 템플릿', 'description': '초안을 수정할 템플릿의 UUID.'},
            'schema': {'additionalProperties': True, 'description': '초안에 덮어쓸 필드/레이아웃 정의(FormSchema).', 'title': '서식 스키마', 'type': 'object'},
        },
        "required": ['template_id', 'schema'],
    },
}
