from ..events import CreditBalanceAtomic
from ..repository import CreditBalanceRepository


class ClearCreditService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> tuple[list[CreditBalanceAtomic], int]:
        # mutate
        removed = await self.repo.remove_by_center(center_id)

        # return
        atomics = [CreditBalanceAtomic.cleared(balance=row)[0] for row in removed]
        return atomics, len(removed)
