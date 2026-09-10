from ..models import Billable
from ..repository import BillableRepository


class ListBillablesByIdsService:
    def __init__(
        self,
        repo: BillableRepository,
    ):
        self._repo = repo

    async def execute(
        self,
        ids: list[str],
    ) -> list[Billable]:
        return await self._repo.list_by_ids(ids)
