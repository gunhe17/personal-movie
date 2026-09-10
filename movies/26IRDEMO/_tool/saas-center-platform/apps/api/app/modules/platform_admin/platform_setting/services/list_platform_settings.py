from ..repository import PlatformSettingRepository


class ListPlatformSettingsService:
    def __init__(
        self,
        repo: PlatformSettingRepository,
    ):
        self.repo = repo

    async def execute(self) -> list:
        # return
        return await self.repo.list_active()
