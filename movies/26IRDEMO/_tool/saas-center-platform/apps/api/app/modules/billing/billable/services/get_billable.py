from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.models import BillableItem
from app.modules.billing.billable_item.repository import BillableItemRepository


class GetBillableService:
    def __init__(
        self,
        billable_repo: BillableRepository,
        item_repo: BillableItemRepository,
    ):
        self.billable_repo = billable_repo
        self.item_repo = item_repo

    async def execute(
        self,
        billable_id: str,
        center_id: str,
    ) -> tuple[Billable, list[BillableItem]]:
        billable = await self.billable_repo.get_in_center(
            billable_id=billable_id,
            center_id=center_id,
        )

        items = await self.item_repo.list_by_billable(billable_id=billable_id)

        return billable, items
