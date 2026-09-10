from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateCloneCreate, TemplateResponse


async def clone_form_template_handler(
    template_id: str,
    center_id: str,
    data: TemplateCloneCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> TemplateResponse:
    facade = FormTemplateFacade(uow)
    atomic, template = await facade.clone_template(
        source_template_id=template_id,
        center_id=center_id,
        name=data.name,
        schema=data.schema_,
    )
    await emit(
        uow,
        "form_template_cloned",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return TemplateResponse.model_validate(template)


TOOL = {
    "name": 'clone_form_template_handler',
    "permission": "write:form_template",
    "purpose": '폼 템플릿을 복제한다.',
    "keywords": ['템플릿 복제', '폼 복사', 'clone template'],
    "boundaries": '폼 템플릿 복제. 생성은 create_form_template_handler.',
    "output": '복제된 폼 템플릿 (TemplateResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_id': {'type': 'string', 'format': 'uuid', 'title': '원본 템플릿', 'description': '복제할 템플릿의 UUID.'},
            'name': {'description': '복제본(센터 템플릿) 이름.', 'maxLength': 100, 'title': '템플릿 이름', 'type': 'string'},
            'schema': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'description': '커스터마이징된 FormSchema(없으면 원본 그대로 복제).', 'title': '서식 스키마'},
        },
        "required": ['template_id', 'name'],
    },
}
