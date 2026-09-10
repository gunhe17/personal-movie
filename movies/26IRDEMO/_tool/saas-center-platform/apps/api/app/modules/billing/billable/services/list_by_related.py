from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.models import BillableItem
from app.modules.billing.billable_item.repository import BillableItemRepository


class ListBillablesByRelatedService:
    def __init__(
        self,
        repo: BillableRepository,
        item_repo: BillableItemRepository,
    ):
        self.repo = repo
        self.item_repo = item_repo

    async def execute(
        self,
        center_id: str,
        related_type: str | list[str],
        related_case_id: str | None = None,
        related_session_id: str | None = None,
    ) -> list[tuple[Billable, list[BillableItem]]]:
        billables = await self.repo.list_by_related(
            center_id=center_id,
            related_type=related_type,
            related_case_id=related_case_id,
            related_session_id=related_session_id,
        )
        rows: list[tuple[Billable, list[BillableItem]]] = []
        for b in billables:
            items = await self.item_repo.list_by_billable(billable_id=b.id)
            rows.append((b, items))
        return rows
