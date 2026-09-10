from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ..repository import PersonRepository
from ..schemas import PersonResponse, PersonUpdate
from ..services.update_person import UpdatePersonService


async def update_person_handler(
    person_id: str,
    data: PersonUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> PersonResponse:
    # 미전달(생략)=유지 / 명시 null=비우기 — model_fields_set으로 구분해 unset 관통
    fields = {k: getattr(data, k) for k in data.model_fields_set}
    for k in ("name", "phone"):
        # non-nullable 컬럼 — 명시 null은 비우기가 아니라 유지로 강등
        if k in fields and fields[k] is None:
            del fields[k]

    person_atomic, person = await UpdatePersonService(uow.repo(PersonRepository)).execute(
        person_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    await emit(
        uow,
        "person_updated",
        event_group_id=event_group_id,
        atomics=[person_atomic],
        actor_id=actor_id,
    )

    return PersonResponse.model_validate(person)


TOOL = {
    "name": 'update_person_handler',
    "permission": None,
    "purpose": '개인 정보를 수정한다.',
    "keywords": ['개인 수정', 'person 편집', '인물 정보 변경'],
    "boundaries": '개인 정보 수정. 생성은 create_person_handler.',
    "output": '수정된 개인 (PersonResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'person_id': {'type': 'string', 'format': 'uuid', 'title': '대상 개인', 'description': '수정할 개인의 UUID.'},
            'name': {'anyOf': [{'maxLength': 100, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '이름', 'description': '이름(미지정 시 유지).'},
            'phone': {'anyOf': [{'maxLength': 20, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '전화번호', 'description': '전화번호(미지정 시 유지).'},
            'birth': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '생년월일', 'description': '생년월일(미지정 시 유지).'},
            'gender': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '성별', 'description': '성별 male/female(미지정 시 유지).'},
        },
        "required": ['person_id'],
    },
}
