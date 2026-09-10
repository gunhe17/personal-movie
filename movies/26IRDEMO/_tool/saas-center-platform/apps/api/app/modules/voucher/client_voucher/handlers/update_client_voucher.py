from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.voucher.client_voucher.schemas import (
    ClientVoucherResponse,
    ClientVoucherUpdate,
)
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def update_client_voucher_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_voucher_id: str,
    data: ClientVoucherUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientVoucherResponse:
    facade = ClientVoucherFacade(uow)
    atomic, record = await facade.update_client_voucher(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
        data=data,
    )
    await emit(
        uow,
        "client_voucher_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    result = await facade.to_response(record)
    return result


TOOL = {
    "name": 'update_client_voucher_handler',
    "permission": "write:voucher",
    "purpose": '내담자 바우처를 수정한다.',
    "keywords": ['update client voucher', '내담자 바우처 수정', '이용권 변경'],
    "boundaries": '내담자 바우처 수정. 발급은 application의 create_client_voucher_handler.',
    "output": '수정된 내담자 바우처 (ClientVoucherResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'client_voucher_id': {'type': 'string', 'format': 'uuid', 'title': '대상 내담자 바우처', 'description': '수정할 내담자 바우처의 UUID.'},
            'total_sessions': {'anyOf': [{'minimum': 1, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '총 회기', 'description': '총 회기 수(미지정 시 유지).'},
            'remaining_sessions': {'anyOf': [{'minimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '잔여 회기', 'description': '잔여 회기 수(미지정 시 유지).'},
            'total_amount': {'anyOf': [{'minimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '총 금액', 'description': '총 금액(원, 미지정 시 유지).'},
            'remaining_amount': {'anyOf': [{'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '잔여 금액', 'description': '잔여 금액(원, 미지정 시 유지).'},
            'valid_from': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '유효 시작일', 'description': '유효 시작일(미지정 시 유지).'},
            'valid_until': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '유효 종료일', 'description': '유효 종료일(미지정 시 유지).'},
        },
        "required": ['client_voucher_id'],
    },
}
