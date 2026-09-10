from app.modules.billing.billable.models import Billable

from ..models import BillableItem
from ..repository import BillableItemRepository


class ListUsageByVoucherService:
    def __init__(
        self,
        repo: BillableItemRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_voucher_id: str,
    ) -> list[tuple[BillableItem, Billable]]:
        return await self.repo.list_usage_by_voucher(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
        )
