from __future__ import annotations

from app.core.datetime_utils import utc_now

from app.core.logger import get_logger
from app.modules.llm.credit_balance.events import CreditBalanceAtomic
from app.modules.llm.credit_balance.models import CreditBalance
from app.modules.llm.credit_balance.plan_config import PLAN_CREDIT_LIMITS
from app.modules.llm.credit_balance.repository import CreditBalanceRepository

logger = get_logger(__name__)


# 만료 기간 감지 시 다음 기간으로 롤오버 — 읽기 시점 lazy 평가(roll_center_period 크론의 보수 경로)
class RollCreditPeriodService:
    def __init__(
        self,
        repo: CreditBalanceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
    ) -> tuple[CreditBalanceAtomic, CreditBalance] | None:
        expired = await self.repo.find_latest_expired(center_id)
        if expired is None:
            return None

        now = utc_now()
        if expired.period_end > now:
            return None

        period_length = expired.period_end - expired.period_start
        new_start = expired.period_end
        new_end = new_start + period_length

        await self.repo.remove_by_id(expired.id)

        credit_limit = PLAN_CREDIT_LIMITS.get(expired.plan_type, expired.credit_limit)
        new_balance = await self.repo.add(
            center_id=center_id,
            plan_type=expired.plan_type,
            credit_limit=credit_limit,
            credit_used=0,
            period_start=new_start,
            period_end=new_end,
        )

        logger.info(
            "Credit period rolled: center=%s plan=%s period=%s~%s",
            center_id[:8],
            expired.plan_type,
            new_start.date(),
            new_end.date(),
        )

        # return
        return CreditBalanceAtomic.rolled(balance=new_balance)
