from ..repository import BillableRepository


class CountUnpaidByCaseIdsService:
    def __init__(
        self,
        repo: BillableRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_ids: list[str],
    ) -> int:
        # return
        return await self.repo.count_unpaid_by_related_case_ids(
            center_id=center_id,
            case_ids=case_ids,
        )
