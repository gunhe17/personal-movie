from ..models import BillableItem
from ..repository import BillableItemRepository


class ListItemsByBillableService:
    def __init__(
        self,
        repo: BillableItemRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        billable_id: str,
    ) -> list[BillableItem]:
        return await self.repo.list_by_billable(billable_id=billable_id)
