from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.platform_setting.repository import (
    PlatformSettingRepository,
)
from app.modules.platform_admin.platform_settings.schemas import (
    PlatformSettingsResponse,
)


async def get_platform_settings_handler(
    uow: UnitOfWork,
) -> PlatformSettingsResponse:
    repo = uow.repo(PlatformSettingRepository)
    settings = await repo.list_active()

    kv = {s.key: s.value for s in settings}
    return PlatformSettingsResponse(
        trial_duration_days=int(kv.get("trial_duration_days", "365")),
        trial_plan=kv.get("trial_plan", "pro"),
        credit_cycle_days=int(kv.get("credit_cycle_days", "30")),
        quota_grace_days=int(kv.get("quota_grace_days", "7")),
    )


TOOL = {
    "name": "get_platform_settings_handler",
    "permission": None,
    "purpose": "플랫폼 전역 설정을 조회한다.",
    "keywords": ["플랫폼 설정 조회", "전역 설정", "platform settings"],
    "boundaries": "운영자 전용 — 플랫폼 설정(읽기). 변경은 update_platform_settings_handler.",
    "output": "플랫폼 전역 설정 (PlatformSettingsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
