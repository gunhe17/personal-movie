from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import CenterApplicationCreate, CenterApplicationResponse


async def create_center_application_handler(
    data: CenterApplicationCreate,
    account_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> CenterApplicationResponse:
    from app.modules.center.facade import CenterApplicationFacade

    facade = CenterApplicationFacade(uow)
    atomic, result = await facade.create_application_with_response(
        account_id=account_id,
        name=data.name,
        phone=data.phone,
        address=data.address.model_dump() if data.address else None,
        description=data.description,
        business_registration_number=data.business_registration_number,
        representative_name=data.representative_name,
    )
    await emit(
        uow,
        "center_application_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )
    return result


TOOL = {
    "name": 'create_center_application_handler',
    "permission": None,
    "agent_exposed": False,  # 온보딩/운영자 표면(admin realm) — 센터 agent 대상 아님
    "purpose": '센터 개설을 신청한다.',
    "keywords": ['센터 신청', '개설 신청', 'application 생성', '입점 신청'],
    "boundaries": "센터 개설 '신청' 생성. 승인은 application/handlers/center_application, 취소는 cancel_center_application_handler.",
    "output": '생성된 센터 개설 신청 (CenterApplicationResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'name': {'description': '개설할 센터 이름.', 'maxLength': 100, 'minLength': 1, 'title': '센터명', 'type': 'string'},
            'phone': {'anyOf': [{'pattern': '^\\d{2,3}-\\d{3,4}-\\d{4}$', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '전화번호(02-1234-5678 형식, 선택).', 'title': '전화번호'},
            'address': {'anyOf': [{'$ref': '#/$defs/AddressInfo'}, {'type': 'null'}], 'default': None, 'description': '주소 정보(우편번호·주소·상세, 선택).'},
            'description': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '소개', 'description': '센터 소개(선택).'},
            'business_registration_number': {'anyOf': [{'pattern': '^\\d{3}-\\d{2}-\\d{5}$', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '사업자등록번호(000-00-00000 형식, 선택).', 'title': '사업자등록번호'},
            'representative_name': {'anyOf': [{'maxLength': 100, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '대표자 이름(선택).', 'title': '대표자명'},
        },
        "$defs": {'AddressInfo': {'properties': {'zip_code': {'anyOf': [{'pattern': '^\\d{5}$', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '5자리 우편번호', 'title': 'Zip Code'}, 'address': {'anyOf': [{'maxLength': 300, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '주소 (도로명/지번)', 'title': 'Address'}, 'detail': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '상세주소', 'title': 'Detail'}}, 'title': 'AddressInfo', 'type': 'object'}},
        "required": ['name'],
    },
}
