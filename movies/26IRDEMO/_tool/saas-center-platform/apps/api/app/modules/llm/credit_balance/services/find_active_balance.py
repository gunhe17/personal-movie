from ..models import CreditBalance
from ..repository import CreditBalanceRepository


class FindActiveBalanceService:
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
        return await self.repo.find_active_by_center(center_id)
