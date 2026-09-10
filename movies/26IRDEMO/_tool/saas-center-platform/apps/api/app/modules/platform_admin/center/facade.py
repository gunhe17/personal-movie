from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import AdminCenterRepository
from .services.list_admin_member_ids import ListAdminMemberIdsService
from .services.warn_center import WarnCenterService


class AdminCenterFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def list_admin_member_ids(
        self,
        center_id: str,
    ) -> list[str]:
        return await ListAdminMemberIdsService(
            self._uow.repo(AdminCenterRepository)
        ).execute(center_id)

    async def warn_center(
        self,
        center_id: str,
        *,
        reason: str,
        notify: bool,
    ):
        return await WarnCenterService(self._uow.repo(AdminCenterRepository)).execute(
            center_id, reason=reason, notify=notify
        )
