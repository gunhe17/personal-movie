from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateCreate, TemplateResponse


async def create_form_template_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: TemplateCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> TemplateResponse:
    facade = FormTemplateFacade(uow)
    atomic, template = await facade.create_template(
        center_id=center_id,
        name=data.name,
        schema=data.schema_,
    )
    await emit(
        uow,
        "form_template_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return TemplateResponse.model_validate(template)


TOOL = {
    "name": 'create_form_template_handler',
    "fn": "create_form_template_handler",
    "permission": "write:form_template",
    "purpose": '폼 템플릿을 생성한다.',
    "keywords": ['create form template', '템플릿 생성', '폼 양식 생성', 'create template'],
    "boundaries": '폼 템플릿 생성. 복제는 clone_form_template_handler, AI 초안은 generate_draft_handler.',
    "output": '생성된 폼 템플릿 (TemplateResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'description': '템플릿 이름.', 'maxLength': 100, 'title': '템플릿 이름', 'type': 'string'},
            'schema': {'additionalProperties': True, 'description': '필드/레이아웃 정의(FormSchema: pages+fields+elements).', 'title': '서식 스키마', 'type': 'object'},
        },
        "required": ['name', 'schema'],
    },
}
