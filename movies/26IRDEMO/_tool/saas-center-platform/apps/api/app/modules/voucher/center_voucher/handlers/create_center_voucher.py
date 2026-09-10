from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.voucher.center_voucher.schemas import (
    CenterVoucherCreate,
    CenterVoucherResponse,
)
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def create_center_voucher_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    account_id: str,
    data: CenterVoucherCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> CenterVoucherResponse:
    facade = CenterVoucherFacade(uow)
    atomic, record = await facade.create_center_voucher(
        center_id=center_id,
        data=data,
        account_id=account_id,
    )
    await emit(
        uow,
        "center_voucher_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    result = await facade.to_response(record)
    return result


TOOL = {
    "name": 'create_center_voucher_handler',
    "permission": "write:voucher",
    "purpose": '센터 바우처를 생성한다.',
    "keywords": ['create center voucher', '센터 바우처 생성', '이용권 등록', 'center voucher 생성'],
    "boundaries": '센터 바우처 생성. 수정은 update_center_voucher_handler, 카탈로그는 list_voucher_catalog_handler.',
    "output": '생성된 센터 바우처 (CenterVoucherResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'catalog_id': {'description': '연결할 카탈로그 바우처(voucher)의 UUID.', 'title': '카탈로그 바우처', 'type': 'string'},
            'unit_price': {'anyOf': [{'minimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '회기당 단가(원, 참고용, 선택).', 'title': '회기 단가'},
            'default_total_sessions': {'anyOf': [{'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '기본 총 회기 수(선택).', 'title': '기본 총 회기'},
            'is_active': {'default': True, 'description': '취급 활성 여부(기본 True).', 'title': '활성 여부', 'type': 'boolean'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '센터 내부 메모(선택).', 'title': '메모'},
        },
        "required": ['catalog_id'],
    },
}
