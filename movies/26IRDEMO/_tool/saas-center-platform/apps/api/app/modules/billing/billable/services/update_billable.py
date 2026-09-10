# 바우처 lock 정책: 항목(quantity/unit_price/client_voucher_id)은 수정 불가(스키마 비노출),
# 회기 차감은 생성 시 1회 — 변경·삭제에도 복원하지 않는다(단일 차감 합의). 정정 = 재발급.
from datetime import date

from app.core.exceptions import InvalidOperationException
from app.core.type import unset
from app.modules.billing.billable.events import BillableAtomic
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.repository import BillableItemRepository
from app.modules.billing.billable.models import Billable


class UpdateBillableService:
    def __init__(
        self,
        repo: BillableRepository,
        item_repo: BillableItemRepository,
    ):
        self.repo = repo
        self.item_repo = item_repo

    async def execute(
        self,
        billable_id: str,
        center_id: str,
        *,
        billable_date: date = unset,
        due_date: date | None = unset,
        memo: str | None = unset,
        discount_amount: int = unset,
        changed: dict | None = None,
    ) -> tuple[BillableAtomic, Billable]:
        # load
        billable = await self.repo.get_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )

        update_data: dict = {}
        if billable_date is not unset:
            update_data["billable_date"] = billable_date
        if due_date is not unset:
            update_data["due_date"] = due_date
        if memo is not unset:
            update_data["memo"] = memo

        # compute (할인액 변경 시 총액/미수금 재계산 — 지원금은 생성 시 lock, 그대로 유지)
        if discount_amount is not unset:
            subtotal = await self.item_repo.aggregate_amount(billable_id=billable_id)
            subsidy = billable.subsidy_amount or 0
            if discount_amount + subsidy > subtotal:
                raise InvalidOperationException(
                    f"할인액({discount_amount:,}원) + 지원금({subsidy:,}원)이 "
                    f"정가 합계({subtotal:,}원)를 초과할 수 없어요"
                )
            new_total = subtotal - subsidy - discount_amount
            new_unpaid = max(new_total - billable.paid_amount, 0)
            update_data["discount_amount"] = discount_amount
            update_data["total_amount"] = new_total
            update_data["unpaid_amount"] = new_unpaid
            # 완납 상태 재평가 (paid ↔ issued 자동 전환)
            if new_unpaid == 0 and new_total > 0 and billable.status == "issued":
                update_data["status"] = "paid"
            elif new_unpaid > 0 and billable.status == "paid":
                update_data["status"] = "issued"

        # return
        if update_data:
            updated = await self.repo.update_in_center(
                billable_id=billable_id,
                center_id=center_id,
                **update_data,
            )
            assert updated is not None
            return BillableAtomic.updated(billable=updated, changed=changed or {})

        return BillableAtomic.updated(billable=billable, changed=changed or {})
