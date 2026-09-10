from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.platform_admin.platform_setting.facade import PlatformSettingFacade
from app.modules.platform_admin.platform_settings.schemas import (
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
)
from app.modules.subscription.subscription.plan_config import (
    invalidate_plan_config_cache,
)


async def update_platform_settings_handler(
    *,
    data: PlatformSettingsUpdate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> PlatformSettingsResponse:
    updates = data.model_dump(exclude_none=True)
    facade = PlatformSettingFacade(uow)
    atomic = await facade.update_platform_settings(updates=updates)

    await emit(
        uow,
        "platform_settings_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    # 캐시 즉시 무효화
    invalidate_plan_config_cache()

    kv = await facade.list_settings_kv()
    return PlatformSettingsResponse(
        trial_duration_days=int(kv.get("trial_duration_days", "365")),
        trial_plan=kv.get("trial_plan", "pro"),
        credit_cycle_days=int(kv.get("credit_cycle_days", "30")),
        quota_grace_days=int(kv.get("quota_grace_days", "7")),
    )


TOOL = {
    "name": "update_platform_settings_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "플랫폼 전역 설정을 수정한다.",
    "keywords": ["플랫폼 설정 변경", "전역 설정 수정", "platform settings 변경"],
    "boundaries": "운영자 전용 — 플랫폼 설정 수정. 조회는 get_platform_settings_handler.",
    "output": "수정된 플랫폼 전역 설정 (PlatformSettingsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "trial_duration_days": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "체험 기간(일)",
                "description": "무료 체험 기간(일, 미지정 시 유지).",
            },
            "trial_plan": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "체험 요금제",
                "description": "체험 시 적용 요금제(미지정 시 유지).",
            },
            "credit_cycle_days": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "크레딧 주기(일)",
                "description": "크레딧 갱신 주기(일, 미지정 시 유지).",
            },
            "quota_grace_days": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "유예 기간(일)",
                "description": "한도 초과 유예 기간(일, 미지정 시 유지).",
            },
        },
        "required": [],
    },
}
