from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientCreate, ClientResponse
from ...facade.profile_facade import ProfileFacade


async def create_client_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: ClientCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientResponse:
    client_atomic, client = await ProfileFacade(uow).create_client(
        center_id=center_id,
        name=data.name,
        role=data.role.value if data.role else "client",
        phone=data.phone,
        birth_date=data.birth_date,
        gender=data.gender.value if data.gender else None,
        email=data.email,
        address=data.address,
        memo=data.memo,
        profile_image_url=data.profile_image_url,
    )
    await emit(
        uow,
        "client_created",
        event_group_id=event_group_id,
        atomics=[client_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientResponse.model_validate(client)


TOOL = {
    "name": 'create_client_handler',
    "permission": "write:client",
    "purpose": '새 내담자를 생성한다.',
    "keywords": ['create client', '내담자 생성', '고객 등록', '내담자 추가', 'client 생성'],
    "boundaries": '단건 내담자 생성. 여러 명은 create_clients_handler, 엑셀은 import_clients_from_excel_handler.',
    "output": '생성된 내담자 (ClientResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'person_id': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '연동할 Person의 UUID(선택).', 'title': '연동 개인'},
            'role': {'$ref': '#/$defs/ClientRole', 'description': '역할: client(내담자)/guardian(보호자)/both(둘 다).'},
            'name': {'description': '이름.', 'maxLength': 100, 'minLength': 1, 'title': '이름', 'type': 'string'},
            'birth_date': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '생년월일(선택).', 'title': '생년월일'},
            'gender': {'anyOf': [{'$ref': '#/$defs/Gender'}, {'type': 'null'}], 'default': None, 'description': '성별: male/female(선택).'},
            'phone': {'anyOf': [{'maxLength': 20, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '전화번호(선택).', 'title': '전화번호'},
            'email': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '이메일(선택).', 'title': '이메일'},
            'address': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '주소(선택).', 'title': '주소'},
            'profile_image_url': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '프로필 이미지 URL(미지정 시 성별 매칭 기본 아바타 자동 배정).', 'title': '프로필 이미지'},
            'status': {'$ref': '#/$defs/ClientStatus', 'default': 'active', 'description': '상태: active/inactive/archived(기본 active).'},
            'memo': {'anyOf': [{'maxLength': 2000, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '메모(선택).', 'title': '메모'},
        },
        "$defs": {'ClientRole': {'enum': ['client', 'guardian', 'both'], 'title': 'ClientRole', 'type': 'string'}, 'ClientStatus': {'enum': ['active', 'inactive', 'archived'], 'title': 'ClientStatus', 'type': 'string'}, 'Gender': {'enum': ['male', 'female'], 'title': 'Gender', 'type': 'string'}},
        "required": ['role', 'name'],
    },
}
