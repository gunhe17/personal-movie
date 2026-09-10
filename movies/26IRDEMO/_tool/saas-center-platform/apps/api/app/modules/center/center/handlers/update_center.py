from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.event import emit
from ..schemas import CenterUpdate, CenterResponse


async def update_center_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: CenterUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> CenterResponse:
    facade = CenterFacade(uow)
    atomic, center = await facade.update_center(center_id, data)
    await emit(
        uow,
        "center_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )

    return CenterResponse.model_validate(center)


TOOL = {
    "name": 'update_center_handler',
    "permission": "write:center",
    "purpose": '센터 기본 정보를 수정한다.',
    "keywords": ['update center', '센터 수정', '센터 정보 변경', 'center 수정', '지점 편집'],
    "boundaries": '센터 정보 수정. 조회는 get_center_handler.',
    "output": '수정된 센터 (CenterResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'anyOf': [{'maxLength': 100, 'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '센터명', 'description': '센터 이름(미지정 시 유지).'},
            'phone': {'anyOf': [{'pattern': '^\\d{2,3}-\\d{3,4}-\\d{4}$', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '전화번호', 'description': '대표 전화번호(02-1234-5678 형식, 미지정 시 유지).'},
            'address': {'anyOf': [{'$ref': '#/$defs/AddressInfo'}, {'type': 'null'}], 'default': None, 'description': '주소 정보(우편번호·주소·상세, 미지정 시 유지).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '소개', 'description': '센터 소개(미지정 시 유지).'},
            'logo_url': {'anyOf': [{'maxLength': 500, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '로고 URL', 'description': '로고 이미지 URL(미지정 시 유지).'},
            'image_urls': {'anyOf': [{'items': {'type': 'string'}, 'type': 'array'}, {'type': 'null'}], 'default': None, 'description': '센터 이미지 URL 목록(미지정 시 유지).', 'title': '이미지 목록'},
            'business_registration_number': {'anyOf': [{'pattern': '^\\d{3}-\\d{2}-\\d{5}$', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '사업자등록번호', 'description': '사업자등록번호(000-00-00000 형식, 미지정 시 유지).'},
            'representative_name': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '대표자명', 'description': '대표자 이름(미지정 시 유지).'},
        },
        "$defs": {'AddressInfo': {'properties': {'zip_code': {'anyOf': [{'pattern': '^\\d{5}$', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '5자리 우편번호', 'title': 'Zip Code'}, 'address': {'anyOf': [{'maxLength': 300, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '주소 (도로명/지번)', 'title': 'Address'}, 'detail': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '상세주소', 'title': 'Detail'}}, 'title': 'AddressInfo', 'type': 'object'}},
        "required": [],
    },
}
