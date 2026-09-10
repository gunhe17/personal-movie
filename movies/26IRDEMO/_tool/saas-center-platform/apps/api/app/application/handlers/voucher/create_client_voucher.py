from app.core.exceptions import EntityNotFoundException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.voucher.client_voucher.schemas import (
    ClientVoucherCreate,
    ClientVoucherResponse,
)
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def create_client_voucher_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    account_id: str,
    data: ClientVoucherCreate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> ClientVoucherResponse:
    client_info = await ClientFacade(uow).find_client_info(data.client_id)
    if not client_info:
        raise EntityNotFoundException(f"Client not found: {data.client_id}")

    facade = ClientVoucherFacade(uow)
    atomic, record = await facade.create_client_voucher(
        center_id=center_id,
        data=data,
        account_id=account_id,
    )
    await emit(
        uow,
        "client_voucher_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    result = await facade.to_response(record)
    return result


TOOL = {
    "name": 'create_client_voucher_handler',
    "permission": "write:voucher",
    "purpose": '내담자에게 바우처(이용권)를 발급한다.',
    "keywords": ['create client voucher', '바우처 발급', '이용권 발급', '내담자 바우처', 'voucher 생성', '쿠폰 발급'],
    "boundaries": "내담자용 바우처를 '발급'한다. 바우처 카탈로그 항목 생성(운영자)은 create_voucher_handler.",
    "output": '발급된 내담자 바우처 (ClientVoucherResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'client_id': {'description': '바우처를 발급할 내담자의 UUID.', 'title': '대상 내담자', 'type': 'string'},
            'center_voucher_id': {'description': '센터 취급 바우처(center_voucher)의 UUID.', 'title': '센터 바우처', 'type': 'string'},
            'total_sessions': {'description': '총 회기 수.', 'minimum': 1, 'title': '총 회기', 'type': 'integer'},
            'remaining_sessions': {'anyOf': [{'minimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '잔여 회기(생략 시 총 회기로 자동 설정).', 'title': '잔여 회기'},
            'total_amount': {'anyOf': [{'minimum': 0, 'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '발급 시점 총 금액 원액(선택).', 'title': '총 금액'},
            'remaining_amount': {'anyOf': [{'type': 'integer'}, {'type': 'null'}], 'default': None, 'description': '잔여 금액(생략 시 총 금액으로 자동 설정, 음수 허용).', 'title': '잔여 금액'},
            'valid_from': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '유효기간 시작일(선택).', 'title': '유효 시작일'},
            'valid_until': {'anyOf': [{'format': 'date', 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '유효기간 종료일(선택).', 'title': '유효 종료일'},
        },
        "required": ['client_id', 'center_voucher_id', 'total_sessions'],
    },
}
