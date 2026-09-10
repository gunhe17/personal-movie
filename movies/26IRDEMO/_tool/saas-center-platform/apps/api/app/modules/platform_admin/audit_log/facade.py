from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import AdminAuditReadRepository
from .services.find_last_admin_act_at import FindLastAdminActAtService


class AdminAuditFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def find_last_admin_act_at(
        self,
        entity_id: str,
        *,
        entity_name: str,
        acts: list,
    ) -> datetime | None:
        return await FindLastAdminActAtService(
            self._uow.repo(AdminAuditReadRepository)
        ).execute(entity_id, entity_name=entity_name, acts=acts)
