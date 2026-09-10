from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CreditRateConfig


class CreditRateConfigRepository(PostgresRepository[CreditRateConfig]):
    model = CreditRateConfig

    # #
    # command

    @typecheck
    async def add(
        self,
        tokens_per_credit: int,
        effective_from: utc_dt,
        effective_to: utc_dt | None = None,
        changed_by: uuid_str | None = None,
        reason: str | None = None,
    ) -> CreditRateConfig:
        return await super().add(
            CreditRateConfig(
                tokens_per_credit=tokens_per_credit,
                effective_from=effective_from,
                effective_to=effective_to,
                changed_by=changed_by,
                reason=reason,
            )
        )

    # #
    # query

    @typecheck
    async def find_active(self) -> CreditRateConfig | None:
        return await self._find(
            where=[CreditRateConfig.effective_to.is_(None)],
            order_by="effective_from",
            descending=True,
        )

    @typecheck
    async def find_active_for_update(self) -> CreditRateConfig | None:
        return await self._find(
            where=[CreditRateConfig.effective_to.is_(None)],
            order_by="effective_from",
            descending=True,
            for_update=True,
        )

