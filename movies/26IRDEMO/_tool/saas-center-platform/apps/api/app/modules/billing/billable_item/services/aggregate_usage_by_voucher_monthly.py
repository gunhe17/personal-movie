from ..repository import BillableItemRepository


class AggregateUsageByVoucherMonthlyService:
    def __init__(
        self,
        repo: BillableItemRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_voucher_id: str,
    ) -> list[tuple[str, int, int, int, int]]:
        return await self.repo.aggregate_usage_by_voucher_monthly(
            center_id=center_id,
            client_voucher_id=client_voucher_id,
        )
