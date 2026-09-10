from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ..repository import PersonRepository
from ..schemas import PersonCreate, PersonResponse
from ..services.create_person import CreatePersonService


async def create_person_handler(
    data: PersonCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> PersonResponse:
    person_atomic, person = await CreatePersonService(uow.repo(PersonRepository)).execute(
        account_id=data.account_id,
        name=data.name,
        phone=data.phone,
        birth=data.birth,
        gender=data.gender,
    )
    await emit(
        uow,
        "person_created",
        event_group_id=event_group_id,
        atomics=[person_atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return PersonResponse.model_validate(person)


TOOL = {
    "name": 'create_person_handler',
    "permission": None,
    "purpose": '개인(person) 정보를 생성한다.',
    "keywords": ['개인 생성', 'person 등록', '인물 추가'],
    "boundaries": '개인 정보 생성. 조회는 get_person_handler.',
    "output": '생성된 개인 (PersonResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'account_id': {'description': '연결할 Account의 UUID.', 'title': '연결 계정', 'type': 'string'},
            'name': {'description': '이름.', 'maxLength': 100, 'minLength': 1, 'title': '이름', 'type': 'string'},
            'phone': {'description': '전화번호.', 'maxLength': 20, 'minLength': 1, 'title': '전화번호', 'type': 'string'},
            'birth': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '생년월일(선택).', 'title': '생년월일'},
            'gender': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '성별: male/female(선택).', 'title': '성별'},
        },
        "required": ['account_id', 'name', 'phone'],
    },
}
