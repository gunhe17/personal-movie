from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.voucher.center_voucher.schemas import (
    CenterVoucherClientItem,
    CenterVoucherClientsResponse,
)
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade
from app.infrastructure.persistence.new_repository import single_page


async def get_voucher_clients_handler(
    center_id: str,
    center_voucher_id: str,
    uow: UnitOfWork,
) -> CenterVoucherClientsResponse:
    rows = await CenterVoucherFacade(uow).list_voucher_client_rows(
        center_id=center_id,
        center_voucher_id=center_voucher_id,
    )
    info_map = await ClientFacade(uow).get_clients_by_ids([r.client_id for r in rows])

    items = [
        CenterVoucherClientItem(
            client_voucher_id=r.id,
            client_id=r.client_id,
            client_name=(
                info_map[r.client_id].name
                if r.client_id in info_map
                else "(알 수 없음)"
            ),
            birth_date=(
                info_map[r.client_id].birth_date if r.client_id in info_map else None
            ),
            gender=(info_map[r.client_id].gender if r.client_id in info_map else None),
            profile_image_url=(
                info_map[r.client_id].profile_image_url
                if r.client_id in info_map
                else None
            ),
            remaining_sessions=r.remaining_sessions,
            total_sessions=r.total_sessions,
            remaining_amount=r.remaining_amount,
            total_amount=r.total_amount,
            valid_from=r.valid_from,
            valid_until=r.valid_until,
        )
        for r in rows
    ]
    return CenterVoucherClientsResponse(items=items, **single_page(rows))


TOOL = {
    "name": "get_voucher_clients_handler",
    "permission": "read:voucher",
    "purpose": "특정 센터 바우처를 사용 중인 내담자 목록을 조회한다.",
    "keywords": [
        "get voucher clients",
        "바우처 사용 내담자",
        "이용권 사용자",
        "바우처 고객 목록",
        "voucher 내담자",
    ],
    "boundaries": "한 센터 바우처의 '사용 내담자' 목록(읽기 전용). 사용 현황 수치는 get_voucher_usage_handler.",
    "output": "바우처 사용 내담자 목록 (CenterVoucherClientsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터 바우처",
                "description": "사용 내담자를 조회할 센터 바우처의 UUID.",
            },
        },
        "required": ["center_voucher_id"],
    },
}
