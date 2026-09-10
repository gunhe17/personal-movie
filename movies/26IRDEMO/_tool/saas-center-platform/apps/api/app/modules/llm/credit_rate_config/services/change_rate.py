from __future__ import annotations

from app.core.datetime_utils import utc_now

from app.core.exceptions import InvalidOperationException
from app.core.logger import get_logger
from app.modules.llm.credit_rate_config.models import CreditRateConfig
from app.modules.llm.credit_rate_config.repository import CreditRateConfigRepository

logger = get_logger(__name__)


class ChangeRateService:
    def __init__(self, repo: CreditRateConfigRepository):
        self.repo = repo

    async def execute(
        self,
        new_rate: int,
        *,
        changed_by: str | None = None,
        reason: str | None = None,
    ) -> CreditRateConfig:
        # verify
        if new_rate <= 0:
            raise InvalidOperationException("토큰/크레딧 비율은 1 이상이어야 합니다.")

        now = utc_now()

        current = await self.repo.find_active_for_update()
        if current:
            if current.tokens_per_credit == new_rate:
                raise InvalidOperationException(
                    f"현재 비율과 동일합니다 ({new_rate} tokens/credit)."
                )
            current.effective_to = now

        new_config = await self.repo.add(
            tokens_per_credit=new_rate,
            effective_from=now,
            effective_to=None,
            changed_by=changed_by,
            reason=reason,
        )

        logger.info(
            "Rate changed: %s → %s tokens/credit by=%s reason=%s",
            current.tokens_per_credit if current else "N/A",
            new_rate,
            changed_by,
            reason,
        )
        return new_config
