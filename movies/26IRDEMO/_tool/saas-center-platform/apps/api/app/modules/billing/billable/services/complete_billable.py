from app.core.exceptions import InvalidOperationException
from app.modules.billing.billable.events import BillableAtomic
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable.models import Billable


class CompleteBillableService:
    def __init__(
        self,
        repo: BillableRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        billable_id: str,
        center_id: str,
    ) -> tuple[BillableAtomic, Billable]:
        # load
        billable = await self.repo.get_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )

        # verify
        if billable.status == "paid":
            raise InvalidOperationException("이미 완납된 청구서입니다")

        # update — 머니 원장 정합: status만 바꾸면 완납 표시인데 미수금이 남아
        # 이후 create_payment(paid 거부)로 회수 불가해진다
        updated = await self.repo.update_in_center(
            billable_id=billable_id,
            center_id=center_id,
            status="paid",
            paid_amount=billable.total_amount,
            unpaid_amount=0,
        )
        assert updated is not None

        return BillableAtomic.updated(billable=updated, changed={"status": "paid"})
