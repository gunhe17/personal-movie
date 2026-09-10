from app.core.type import utc_dt
from app.modules.billing.billable.repository import BillableRepository


class AggregateUnpaidSummaryService:
    def __init__(
        self,
        repo: BillableRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[int, int, utc_dt | None]:
        return await self.repo.aggregate_unpaid_summary_for_client(
            center_id=center_id,
            client_id=client_id,
        )
