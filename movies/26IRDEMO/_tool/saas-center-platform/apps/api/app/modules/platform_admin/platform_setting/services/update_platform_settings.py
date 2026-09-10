from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.platform_setting.repository import PlatformSettingRepository


class UpdatePlatformSettingsService:
    def __init__(self, repo: PlatformSettingRepository):
        self.repo = repo

    async def execute(self, *, updates: dict) -> AdminAuditAtomic:
        # apply
        for key, value in updates.items():
            await self.repo.update_value(key=key, value=str(value))

        # return
        return AdminAuditAtomic(
            _act="updated",
            _entity_name="platform_settings",
            _entity_id="system",
            _payload={"data": updates},
        )
