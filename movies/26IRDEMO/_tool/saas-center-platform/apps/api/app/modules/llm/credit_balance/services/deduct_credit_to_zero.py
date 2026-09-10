from __future__ import annotations

from app.core.logger import get_logger
from app.modules.llm.credit_balance.events import CreditBalanceAtomic
from app.modules.llm.credit_balance.plan_config import TOKENS_PER_CREDIT
from app.modules.llm.credit_balance.repository import CreditBalanceRepository
from app.modules.llm.credit_balance.services.deduct_credit import tokens_to_credits

logger = get_logger(__name__)


class DeductCreditToZeroService:
    """agent 전용 — 남은 잔액까지만 차감(0에서 멈춤, 음수 없음). 초과분은 흡수.

    스트리밍 턴은 중간에 안 끊으므로, 초과가 나도 잔액을 비우는 선에서 정산한다.
    공유 DeductCreditService(soft-cap)와 분리 — 이 정책은 agent에만 유효.
    """

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
            return None, effective_rate, 0

        remaining = max(0, row.credit_limit - row.credit_used)
        charged = min(credits, remaining)
        if credits > charged:
            logger.warning(
                "Credit drained (agent): center=%s want=%d remaining=%d (흡수=%d)",
                center_id[:8], credits, remaining, credits - charged,
            )
        updated = await self.repo.update_in_place(
            row.id, credit_used=row.credit_used + charged
        )
        assert updated is not None

        # return
        atomic, _ = CreditBalanceAtomic.deducted(balance=updated)
        return atomic, effective_rate, charged
