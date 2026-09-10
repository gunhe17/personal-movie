from ..repository import BillableRepository


class AggregateBillablesService:
    def __init__(self, repo: BillableRepository):
        self._repo = repo

    async def execute(
        self,
        center_id: str,
        **filters,
    ) -> dict:
        count, total_sum, unpaid_sum = await self._repo.aggregate_in_center(
            center_id, **filters,
        )
        return {"count": count, "total_amount_sum": total_sum, "unpaid_amount_sum": unpaid_sum}
