from app.modules.billing.billable.events import BillableAtomic
from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository


class ApplyPaymentTotalsService:
    def __init__(
        self,
        repo: BillableRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        billable_id: str,
        center_id: str,
        *,
        total_paid: int,
        total_amount: int,
    ) -> tuple[BillableAtomic, Billable]:
        # compute (미수금 0 = 자동 완납)
        unpaid = total_amount - total_paid

        # update
        fields: dict = {"paid_amount": total_paid, "unpaid_amount": unpaid}
        if unpaid <= 0:
            fields["status"] = "paid"
        updated = await self.repo.update_in_center(
            billable_id=billable_id,
            center_id=center_id,
            **fields,
        )
        assert updated is not None

        # return
        return BillableAtomic.updated(billable=updated, changed=fields)
