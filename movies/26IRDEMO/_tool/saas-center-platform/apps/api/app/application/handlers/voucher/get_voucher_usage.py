from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import BillableFacade
from app.modules.voucher.client_voucher.schemas import (
    VoucherUsageItem,
    VoucherUsageResponse,
)
from app.modules.voucher.facade.client_voucher_facade import ClientVoucherFacade


async def get_voucher_usage_handler(
    center_id: str,
    client_voucher_id: str,
    uow: UnitOfWork,
) -> VoucherUsageResponse:
    await ClientVoucherFacade(uow).verify_client_voucher(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
    )
    rows = await BillableFacade(uow).list_usage_by_voucher(
        center_id=center_id,
        client_voucher_id=client_voucher_id,
    )

    items = [
        VoucherUsageItem(
            billable_item_id=item.id,
            billable_id=item.billable_id,
            billable_date=billable.billable_date,
            description=item.description,
            quantity=item.quantity,
            amount=item.amount,
            subsidy_amount=item.subsidy_amount,
            related_case_id=item.related_case_id,
            related_session_id=item.related_session_id,
            created_at=item.created_at,
        )
        for item, billable in rows
    ]

    # 차감 회기 = 고유 (related_session_id ?? related_case_id ?? item) 개수 — 실제 차감과 정합
    session_keys = {
        i.related_session_id or i.related_case_id or i.billable_item_id for i in items
    }

    return VoucherUsageResponse(
        client_voucher_id=client_voucher_id,
        items=items,
        total_sessions_used=len(session_keys),
        total_amount_used=sum(i.amount for i in items),
        total_subsidy_used=sum(i.subsidy_amount for i in items),
    )


TOOL = {
    "name": "get_voucher_usage_handler",
    "permission": "read:voucher",
    "purpose": "내담자 바우처의 사용 현황을 조회한다.",
    "keywords": [
        "get voucher usage",
        "바우처 사용 현황",
        "이용권 잔여",
        "바우처 소진",
        "voucher usage",
        "사용량 조회",
    ],
    "boundaries": "한 내담자 바우처의 '사용/잔여' 현황(읽기 전용). 월별 추이는 get_voucher_usage_monthly_handler.",
    "output": "바우처 사용/잔여 현황 (VoucherUsageResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_voucher_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자 바우처",
                "description": "사용 현황을 조회할 내담자 바우처의 UUID.",
            },
        },
        "required": ["client_voucher_id"],
    },
}
