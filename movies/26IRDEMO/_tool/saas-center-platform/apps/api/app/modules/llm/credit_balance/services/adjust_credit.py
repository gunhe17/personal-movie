from app.core.exceptions import EntityNotFoundException, InvalidOperationException

from ..events import CreditBalanceAtomic
from ..models import CreditBalance
from ..repository import CreditBalanceRepository


class AdjustCreditService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        adjust_type: str,
        amount: int = 0,
    ) -> tuple[CreditBalanceAtomic, CreditBalance]:
        # load (FOR UPDATE — 동시 차감과 직렬화)
        balance = await self.repo.find_active_for_update(center_id)
        if not balance:
            raise EntityNotFoundException(
                f"크레딧 레코드를 찾을 수 없습니다: center={center_id}"
            )

        # mutate
        if adjust_type == "add":
            if amount <= 0:
                raise InvalidOperationException("추가할 크레딧은 0보다 커야 합니다.")
            updated = await self.repo.increment_credit_limit(balance.id, amount=amount)
        elif adjust_type == "reset":
            updated = await self.repo.update_in_place(balance.id, credit_used=0)
        else:
            raise InvalidOperationException(f"잘못된 조정 타입: {adjust_type}")

        assert updated is not None

        # return
        return CreditBalanceAtomic.adjusted(balance=updated)
