from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import AdminAiUsageRepository
from .services.aggregate_top_credit_users import AggregateTopCreditUsersService


class AdminAiUsageFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def aggregate_top_credit_users(
        self,
        *,
        limit: int = 10,
    ) -> list[dict]:
        return await AggregateTopCreditUsersService(
            self._uow.repo(AdminAiUsageRepository)
        ).execute(limit=limit)
