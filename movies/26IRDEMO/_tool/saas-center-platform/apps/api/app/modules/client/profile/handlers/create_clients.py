from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import CreateClientsRequest, CreateClientsResponse
from ...facade.profile_facade import ProfileFacade


async def create_clients_handler(
    center_id: str,
    data: CreateClientsRequest,
    uow: UnitOfWork,
    actor_id: str,
    *,
    event_group_id: uuid_str,
) -> CreateClientsResponse:
    facade = ProfileFacade(uow)
    atomics, result = await facade.create_clients_with_response(center_id, data)
    await emit(
        uow,
        "clients_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'create_clients_handler',
    "permission": "write:client",
    "purpose": '여러 내담자를 한 번에 일괄 생성한다.',
    "keywords": ['batch create clients', '내담자 일괄 생성', '고객 일괄 등록', 'batch 생성', '여러명 등록'],
    "boundaries": '여러 내담자 일괄 생성. 단건은 create_client_handler, 엑셀 업로드는 import_clients_from_excel_handler.',
    "output": '일괄 생성 결과 (CreateClientsResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'guardians': {'description': '함께 등록할 보호자 목록(최소 1명).', 'items': {'$ref': '#/$defs/GuardianInput'}, 'minItems': 1, 'title': '보호자 목록', 'type': 'array'},
            'children': {'description': '함께 등록할 자녀(내담자) 목록(최소 1명).', 'items': {'$ref': '#/$defs/ChildInput'}, 'minItems': 1, 'title': '자녀 목록', 'type': 'array'},
        },
        "$defs": {'ChildInput': {'properties': {'name': {'description': '이름', 'maxLength': 100, 'minLength': 1, 'title': 'Name', 'type': 'string'}, 'birth_date': {'description': '생년월일', 'format': 'date', 'title': 'Birth Date', 'type': 'string'}, 'gender': {'$ref': '#/$defs/Gender', 'description': '성별'}, 'phone': {'anyOf': [{'maxLength': 20, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '연락처', 'title': 'Phone'}, 'memo': {'anyOf': [{'maxLength': 2000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '메모', 'title': 'Memo'}}, 'required': ['name', 'birth_date', 'gender'], 'title': 'ChildInput', 'type': 'object'}, 'Gender': {'enum': ['male', 'female'], 'title': 'Gender', 'type': 'string'}, 'GuardianInput': {'properties': {'existing_client_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '기존 보호자 Client ID (재사용)', 'title': 'Existing Client Id'}, 'name': {'description': '이름', 'maxLength': 100, 'minLength': 1, 'title': 'Name', 'type': 'string'}, 'birth_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '생년월일', 'title': 'Birth Date'}, 'gender': {'anyOf': [{'$ref': '#/$defs/Gender'}, {'type': 'null'}], 'default': None, 'description': '성별'}, 'phone': {'description': '전화번호', 'maxLength': 20, 'minLength': 1, 'title': 'Phone', 'type': 'string'}, 'email': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '이메일', 'title': 'Email'}, 'address': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '주소', 'title': 'Address'}, 'relation_type': {'default': 'parent', 'description': '관계 유형 (parent)', 'title': 'Relation Type', 'type': 'string'}, 'relation_detail': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '관계 상세 (guardian만): mother, father, grandmother, grandfather, aunt, uncle, caregiver 등', 'title': 'Relation Detail'}, 'is_primary': {'description': '주 보호자 여부', 'title': 'Is Primary', 'type': 'boolean'}, 'memo': {'anyOf': [{'maxLength': 2000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '메모', 'title': 'Memo'}}, 'required': ['name', 'phone', 'is_primary'], 'title': 'GuardianInput', 'type': 'object'}},
        "required": ['guardians', 'children'],
    },
}
