from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import UpdateClientWithRelationsRequest, UpdateClientWithRelationsResponse
from ...facade.profile_facade import ProfileFacade


async def update_client_with_relations_handler(
    center_id: str,
    client_id: str,
    data: UpdateClientWithRelationsRequest,
    uow: UnitOfWork,
    actor_id: str,
    *,
    event_group_id: uuid_str,
) -> UpdateClientWithRelationsResponse:
    facade = ProfileFacade(uow)
    atomics, result = await facade.update_client_with_relations_with_response(
        center_id, client_id, data
    )
    await emit(
        uow,
        "client_updated",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'update_client_with_relations_handler',
    "permission": "write:client",
    "purpose": '한 내담자의 여러 정보를 일괄 수정한다.',
    "keywords": ['batch update client', '내담자 일괄 수정', '고객 정보 일괄 변경', 'batch update'],
    "boundaries": '한 내담자의 여러 필드를 한 번에 수정. 단일 수정은 update_client_handler.',
    "output": '일괄 수정 결과 (UpdateClientWithRelationsResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'client_id': {'type': 'string', 'format': 'uuid', 'title': '대상 내담자', 'description': '수정할 내담자의 UUID.'},
            'client': {'$ref': '#/$defs/ClientUpdate', 'description': '내담자 프로필 수정 데이터.'},
            'guardians': {'description': '보호자 전체 목록(화면에 표시된 최종 상태 그대로 전송 — 서버가 추가/삭제 동기화).', 'items': {'$ref': '#/$defs/GuardianUpdateInput'}, 'title': '보호자 목록', 'type': 'array'},
        },
        "$defs": {'ClientRole': {'enum': ['client', 'guardian', 'both'], 'title': 'ClientRole', 'type': 'string'}, 'ClientStatus': {'enum': ['active', 'inactive', 'archived'], 'title': 'ClientStatus', 'type': 'string'}, 'ClientUpdate': {'examples': [{'address': '서울특별시 서초구 서초대로 78길 15', 'email': 'updated.email@example.com', 'memo': '연락처 변경됨. 다음 상담 일정 조율 필요', 'phone': '010-8888-9999'}, {'memo': '상담 종료 - 증상 호전으로 졸업', 'status': 'inactive'}], 'properties': {'role': {'anyOf': [{'$ref': '#/$defs/ClientRole'}, {'type': 'null'}], 'default': None}, 'name': {'anyOf': [{'maxLength': 100, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Name'}, 'birth_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Birth Date'}, 'gender': {'anyOf': [{'$ref': '#/$defs/Gender'}, {'type': 'null'}], 'default': None}, 'phone': {'anyOf': [{'maxLength': 20, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Phone'}, 'email': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Email'}, 'address': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Address'}, 'profile_image_url': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '프로필 이미지 URL', 'title': 'Profile Image Url'}, 'status': {'anyOf': [{'$ref': '#/$defs/ClientStatus'}, {'type': 'null'}], 'default': None}, 'memo': {'anyOf': [{'maxLength': 2000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': 'Memo'}}, 'title': 'ClientUpdate', 'type': 'object'}, 'Gender': {'enum': ['male', 'female'], 'title': 'Gender', 'type': 'string'}, 'GuardianUpdateInput': {'properties': {'client_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '기존 보호자 Client ID (None이면 신규 추가)', 'title': 'Client Id'}, 'name': {'description': '이름', 'maxLength': 100, 'minLength': 1, 'title': 'Name', 'type': 'string'}, 'birth_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '생년월일', 'title': 'Birth Date'}, 'gender': {'anyOf': [{'$ref': '#/$defs/Gender'}, {'type': 'null'}], 'default': None, 'description': '성별'}, 'phone': {'description': '전화번호', 'maxLength': 20, 'minLength': 1, 'title': 'Phone', 'type': 'string'}, 'email': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '이메일', 'title': 'Email'}, 'address': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '주소', 'title': 'Address'}, 'relation_detail': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '관계 상세: mother, father, grandmother, grandfather, aunt, uncle, caregiver 등', 'title': 'Relation Detail'}, 'is_primary': {'description': '주 보호자 여부', 'title': 'Is Primary', 'type': 'boolean'}, 'memo': {'anyOf': [{'maxLength': 2000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '메모', 'title': 'Memo'}}, 'required': ['name', 'phone', 'is_primary'], 'title': 'GuardianUpdateInput', 'type': 'object'}},
        "required": ['client_id', 'client'],
    },
}
