from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_template_facade import FormTemplateFacade
from app.modules.form.template.schemas import TemplateResponse, TemplateVersionCreate


async def create_form_template_version_handler(
    *,
    event_group_id: uuid_str,
    template_id: str,
    center_id: str,
    data: TemplateVersionCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> TemplateResponse:
    facade = FormTemplateFacade(uow)
    atomic, template = await facade.create_template_version(
        template_id=template_id,
        center_id=center_id,
        schema=data.schema_,
    )
    await emit(
        uow,
        "form_template_version_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return TemplateResponse.model_validate(template)


TOOL = {
    "name": 'create_form_template_version_handler',
    "permission": "write:form_template",
    "purpose": '폼 템플릿의 새 버전을 생성한다.',
    "keywords": ['create template version', '템플릿 버전 생성', '양식 버전', 'template version'],
    "boundaries": "템플릿 새 '버전' 생성. 게시는 publish_form_template_handler.",
    "output": '새 버전 폼 템플릿 (TemplateResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_id': {'type': 'string', 'format': 'uuid', 'title': '대상 템플릿', 'description': '새 버전을 만들 템플릿의 UUID.'},
            'schema': {'additionalProperties': True, 'description': '새 버전의 필드/레이아웃 정의(FormSchema).', 'title': '서식 스키마', 'type': 'object'},
        },
        "required": ['template_id', 'schema'],
    },
}
