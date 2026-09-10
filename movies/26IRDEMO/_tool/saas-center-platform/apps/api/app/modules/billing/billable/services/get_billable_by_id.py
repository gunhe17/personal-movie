from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository


class GetBillableByIdService:
    def __init__(
        self,
        repo: BillableRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        billable_id: str,
        center_id: str,
    ) -> Billable:
        return await self.repo.get_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )
