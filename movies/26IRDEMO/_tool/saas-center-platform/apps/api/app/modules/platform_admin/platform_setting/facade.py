from app.infrastructure.persistence.unit_of_work import UnitOfWork

from .repository import PlatformSettingRepository
from .services.list_platform_settings import ListPlatformSettingsService
from .services.update_platform_settings import UpdatePlatformSettingsService


class PlatformSettingFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def list_settings_kv(self) -> dict[str, str]:
        settings = await ListPlatformSettingsService(
            self._uow.repo(PlatformSettingRepository)
        ).execute()
        return {s.key: s.value for s in settings}

    async def update_platform_settings(
        self,
        *,
        updates: dict,
    ):
        return await UpdatePlatformSettingsService(
            self._uow.repo(PlatformSettingRepository)
        ).execute(updates=updates)
