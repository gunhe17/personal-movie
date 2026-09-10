from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ..repository import PersonCredentialRepository
from ..schemas import CredentialResponse, CredentialUpdate
from ..services import UpdateCredentialService


async def update_credential_handler(
    credential_id: str,
    person_id: str,
    data: CredentialUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> CredentialResponse:
    # 미전달(생략)=유지 / 명시 null=비우기 — model_fields_set으로 구분해 unset 관통
    fields = {k: getattr(data, k) for k in data.model_fields_set}
    for k in ("title", "organization", "is_current"):
        # non-nullable 컬럼 — 명시 null은 비우기가 아니라 유지로 강등
        if k in fields and fields[k] is None:
            del fields[k]

    atomic, credential = await UpdateCredentialService(uow.repo(PersonCredentialRepository)).execute(
        credential_id,
        person_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    await emit(
        uow,
        "person_credential_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )
    return CredentialResponse.from_orm_model(credential)


TOOL = {
    "name": 'update_credential_handler',
    "permission": None,
    "purpose": '개인 자격 정보를 수정한다.',
    "keywords": ['자격 수정', '자격증 편집', 'credential 수정'],
    "boundaries": '개인 자격 수정. 등록은 create_credential_handler.',
    "output": '수정된 자격 (CredentialResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'credential_id': {'type': 'string', 'format': 'uuid', 'title': '대상 자격', 'description': '수정할 자격의 UUID.'},
            'title': {'anyOf': [{'maxLength': 200, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '제목', 'description': '자격 제목(미지정 시 유지).'},
            'organization': {'anyOf': [{'maxLength': 200, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '소속 기관', 'description': '소속 기관(미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '설명', 'description': '부가 설명(미지정 시 유지).'},
            'start_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '시작일', 'description': '시작일(미지정 시 유지).'},
            'end_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '종료일', 'description': '종료일(미지정 시 유지).'},
            'is_current': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'title': '진행 중 여부', 'description': '재학·재직 중 여부(미지정 시 유지).'},
            'meta': {'anyOf': [{'additionalProperties': True, 'type': 'object'}, {'type': 'null'}], 'default': None, 'title': '추가 정보', 'description': 'kind별 추가 필드(미지정 시 유지).'},
        },
        "required": ['credential_id'],
    },
}
