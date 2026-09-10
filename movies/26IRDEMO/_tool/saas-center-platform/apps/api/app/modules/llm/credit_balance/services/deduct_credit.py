from __future__ import annotations

from app.core.logger import get_logger
from app.modules.llm.credit_balance.events import CreditBalanceAtomic
from app.modules.llm.credit_balance.plan_config import TOKENS_PER_CREDIT
from app.modules.llm.credit_balance.repository import CreditBalanceRepository

logger = get_logger(__name__)


def tokens_to_credits(
    tokens: int,
    tokens_per_credit: int = TOKENS_PER_CREDIT,
) -> int:
    return max(1, (tokens + tokens_per_credit - 1) // tokens_per_credit)


class DeductCreditService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        tokens_used: int,
        *,
        rate: int | None = None,
    ) -> tuple[CreditBalanceAtomic | None, int, int]:
        effective_rate = rate or TOKENS_PER_CREDIT
        credits = tokens_to_credits(tokens_used, effective_rate)
        row = await self.repo.find_active_for_update(center_id)
        if not row:
            return None, effective_rate, credits

        # ponytail: soft-cap — 사전 게이트(check_quota)가 다음 호출을 막으므로 초과는
        # 한 호출분으로 유계. 하드캡이 필요하면 reservation(사전 홀드→사후 정산) 패턴.
        new_used = row.credit_used + credits
        if new_used > row.credit_limit:
            logger.warning(
                "Credit overflow: center=%s used=%d+%d limit=%d (초과=%d)",
                center_id[:8],
                row.credit_used,
                credits,
                row.credit_limit,
                new_used - row.credit_limit,
            )
        updated = await self.repo.update_in_place(row.id, credit_used=new_used)
        assert updated is not None

        # return
        atomic, _ = CreditBalanceAtomic.deducted(balance=updated)
        return atomic, effective_rate, credits
