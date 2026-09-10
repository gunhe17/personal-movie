from ..events import CreditBalanceAtomic
from ..models import CreditBalance
from ..repository import CreditBalanceRepository


class SetCreditUsedService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        credit_used: int,
    ) -> tuple[CreditBalanceAtomic | None, CreditBalance | None]:
        # load
        balance = await self.repo.find_active_for_update(center_id)
        if not balance:
            return None, None

        # mutate
        updated = await self.repo.update_in_place(balance.id, credit_used=credit_used)
        assert updated is not None

        # return
        return CreditBalanceAtomic.used_set(balance=updated)
