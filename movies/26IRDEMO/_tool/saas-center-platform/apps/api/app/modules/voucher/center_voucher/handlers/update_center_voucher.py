from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.voucher.center_voucher.schemas import (
    CenterVoucherResponse,
    CenterVoucherUpdate,
)
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def update_center_voucher_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    center_voucher_id: str,
    data: CenterVoucherUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> CenterVoucherResponse:
    facade = CenterVoucherFacade(uow)
    atomic, record = await facade.update_center_voucher(
        center_id=center_id,
        center_voucher_id=center_voucher_id,
        data=data,
    )
    await emit(
        uow,
        "center_voucher_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    result = await facade.to_response(record)
    return result


TOOL = {
    "name": 'update_center_voucher_handler',
    "permission": "write:voucher",
    "purpose": '센터 바우처를 수정한다.',
    "keywords": ['update center voucher', '센터 바우처 수정', '이용권 변경'],
    "boundaries": '센터 바우처 수정. 생성은 create_center_voucher_handler.',
    "output": '수정된 센터 바우처 (CenterVoucherResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'center_voucher_id': {'type': 'string', 'format': 'uuid', 'title': '대상 센터 바우처', 'description': '수정할 센터 바우처의 UUID.'},
            'unit_price': {'anyOf': [{'minimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '회기당 단가(원, 미지정 시 유지).', 'title': '회기 단가'},
            'default_total_sessions': {'anyOf': [{'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '기본 총 회기 수(미지정 시 유지).', 'title': '기본 총 회기'},
            'is_active': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'description': '취급 활성 여부(미지정 시 유지).', 'title': '활성 여부'},
            'memo': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '센터 내부 메모(미지정 시 유지).', 'title': '메모'},
        },
        "required": ['center_voucher_id'],
    },
}
