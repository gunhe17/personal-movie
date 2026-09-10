from __future__ import annotations

from datetime import datetime

from app.core.exceptions import InvalidOperationException
from app.modules.llm.credit_balance.events import CreditBalanceAtomic
from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.llm.credit_balance.plan_config import PLAN_CREDIT_LIMITS
from app.modules.llm.credit_balance.repository import CreditBalanceRepository


class InitializeCreditService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        plan_type: str,
        period_start: datetime,
        period_end: datetime,
    ) -> tuple[CreditBalanceAtomic, CreditBalance]:
        # verify
        credit_limit = PLAN_CREDIT_LIMITS.get(plan_type)
        if credit_limit is None:
            raise InvalidOperationException(f"Unknown plan type: {plan_type}")

        await self.repo.remove_by_center(center_id)

        # mutate
        balance = await self.repo.add(
            center_id=center_id,
            plan_type=plan_type,
            credit_limit=credit_limit,
            credit_used=0,
            period_start=period_start,
            period_end=period_end,
        )

        # return
        return CreditBalanceAtomic.created(balance=balance)
