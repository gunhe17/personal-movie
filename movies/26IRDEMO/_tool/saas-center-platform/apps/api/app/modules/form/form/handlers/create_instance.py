from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.form.schemas import FormCreate, FormResponse


async def create_instance_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: FormCreate,
    uow: UnitOfWork,
    created_by: str | None = None,
    actor_id: str,
) -> FormResponse:
    facade = FormFacade(uow)
    atomic, instance = await facade.create_instance(
        center_id=center_id,
        template_id=data.template_id,
        created_by=created_by,
    )
    await emit(
        uow,
        "form_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return FormResponse.model_validate(instance)


TOOL = {
    "name": 'create_instance_handler',
    "permission": "write:form_instance",
    "purpose": '폼 템플릿으로부터 작성용 폼 인스턴스를 생성한다.',
    "keywords": ['create instance', '폼 생성', '폼 인스턴스', '설문 생성', 'form 인스턴스'],
    "boundaries": '템플릿 기반 폼 인스턴스 생성. 답변 저장은 upsert_answers_handler, 제출은 submit_instance_handler.',
    "output": '생성된 폼 인스턴스 (FormResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'template_id': {'description': '인스턴스를 만들 폼 템플릿의 UUID.', 'title': '대상 템플릿', 'type': 'string'},
        },
        "required": ['template_id'],
    },
}
