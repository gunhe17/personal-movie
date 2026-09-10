from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ..repository import PersonCredentialRepository
from ..schemas import CredentialCreate, CredentialResponse
from ..services import CreateCredentialService


async def create_credential_handler(
    person_id: str,
    data: CredentialCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> CredentialResponse:
    atomic, credential = await CreateCredentialService(uow.repo(PersonCredentialRepository)).execute(
        person_id=person_id,
        credential_type=data.credential_type,
        title=data.title,
        organization=data.organization,
        meta=data.meta,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
        is_current=data.is_current,
    )
    await emit(
        uow,
        "person_credential_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )
    return CredentialResponse.from_orm_model(credential)


TOOL = {
    "name": 'create_credential_handler',
    "permission": None,
    "purpose": '개인의 자격(자격증·면허)을 등록한다.',
    "keywords": ['자격 등록', '자격증 추가', 'credential 생성', '면허 등록'],
    "boundaries": '개인 자격 등록. 검증 요청은 request_verification_handler, 첨부는 upload_credential_attachment_handler.',
    "output": '등록된 자격 (CredentialResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'credential_type': {'description': '종류: education(학력)/career(경력)/certification(자격증).', 'enum': ['education', 'career', 'certification'], 'title': '종류', 'type': 'string'},
            'title': {'description': '자격 제목(학위명·직위·자격증명).', 'maxLength': 200, 'minLength': 1, 'title': '제목', 'type': 'string'},
            'organization': {'description': '소속 기관(학교·회사·발급기관).', 'maxLength': 200, 'minLength': 1, 'title': '소속 기관', 'type': 'string'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '부가 설명(선택).', 'title': '설명'},
            'start_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '시작일(입학/입사/발급, 선택).', 'title': '시작일'},
            'end_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '종료일(졸업/퇴사/만료, 선택).', 'title': '종료일'},
            'is_current': {'default': False, 'description': '재학·재직 중 여부(자격증은 항상 False).', 'title': '진행 중 여부', 'type': 'boolean'},
            'meta': {'additionalProperties': True, 'description': 'kind별 추가 필드(degree/position/certificate_number 등).', 'title': '추가 정보', 'type': 'object'},
        },
        "required": ['credential_type', 'title', 'organization', 'meta'],
    },
}
