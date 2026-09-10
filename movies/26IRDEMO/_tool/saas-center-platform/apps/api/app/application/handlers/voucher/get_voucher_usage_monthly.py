from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import BillableFacade
from app.modules.voucher.client_voucher.schemas import (
    VoucherMonthlyUsageItem,
    VoucherMonthlyUsageResponse,
)
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def get_voucher_usage_monthly_handler(
    center_id: str,
    client_voucher_id: str,
    uow: UnitOfWork,
) -> VoucherMonthlyUsageResponse:
    await ClientVoucherFacade(uow).verify_client_voucher(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
    )
    rows = await BillableFacade(uow).aggregate_usage_by_voucher_monthly(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
    )

    return VoucherMonthlyUsageResponse(
        client_voucher_id=client_voucher_id,
        items=[
            VoucherMonthlyUsageItem(
                year_month=ym,
                sessions=sessions,
                amount=amount,
                subsidy_amount=subsidy,
                item_count=count,
            )
            for ym, sessions, amount, subsidy, count in rows
        ],
    )


TOOL = {
    "name": "get_voucher_usage_monthly_handler",
    "permission": "read:voucher",
    "purpose": "내담자 바우처의 월별 사용 추이를 조회한다.",
    "keywords": [
        "get voucher usage monthly",
        "바우처 월별 사용",
        "이용권 월별 추이",
        "월간 사용량",
        "voucher monthly",
    ],
    "boundaries": "한 내담자 바우처의 '월별' 사용 추이(읽기 전용). 현재 현황은 get_voucher_usage_handler.",
    "output": "바우처 월별 사용 추이 (VoucherMonthlyUsageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자 바우처",
                "description": "월별 사용 추이를 조회할 내담자 바우처의 UUID.",
            },
        },
        "required": ["client_voucher_id"],
    },
}
