from ..models import CreditBalance
from ..repository import CreditBalanceRepository


class FindLastConsumedBalanceService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> CreditBalance | None:
        # return
        return await self.repo.find_last_consumed_including_deleted(center_id)
