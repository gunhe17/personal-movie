from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.center_voucher.schemas import CenterVoucherStatsResponse
from app.modules.voucher.facade.center_voucher_facade import CenterVoucherFacade


async def get_voucher_stats_handler(
    center_id: str,
    expiring_window_days: int,
    uow: UnitOfWork,
) -> CenterVoucherStatsResponse:
    facade = CenterVoucherFacade(uow)
    return await facade.get_voucher_stats_with_response(
        center_id=center_id,
        expiring_window_days=expiring_window_days,
    )


TOOL = {
    "name": "get_voucher_stats_handler",
    "permission": "read:voucher",
    "purpose": "센터 바우처 통계(만료 임박 등)를 조회한다.",
    "keywords": ["바우처 통계", "이용권 현황", "voucher stats"],
    "boundaries": "센터 바우처 통계(읽기). 사용 내담자는 application의 get_voucher_clients_handler.",
    "output": "센터 바우처 통계, 만료 임박 등 (CenterVoucherStatsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "expiring_window_days": {
                "type": "integer",
                "title": "만료 임박 기준(일)",
                "description": "이 일수 이내 만료를 '임박'으로 집계.",
            },
        },
        "required": ["expiring_window_days"],
    },
}
