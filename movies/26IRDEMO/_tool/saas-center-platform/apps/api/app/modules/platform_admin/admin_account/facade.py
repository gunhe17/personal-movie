from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import AdminAccountRepository
from .services.aggregate_admin_names import AggregateAdminNamesService


class AdminAccountFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def aggregate_admin_names(
        self,
        ids: list,
    ) -> dict:
        return await AggregateAdminNamesService(
            self._uow.repo(AdminAccountRepository)
        ).execute(ids)
