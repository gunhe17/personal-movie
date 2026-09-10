from fastapi import APIRouter, Depends

from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS
from app.modules.platform_admin.platform_settings.handlers import (
    get_platform_settings_handler,
    get_plan_configs_handler,
)
from app.application.handlers.platform.update_platform_settings import (
    update_platform_settings_handler,
)
from app.application.handlers.platform.update_plan_config import (
    update_plan_config_handler,
)
from app.modules.platform_admin.platform_settings.schemas import (
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
    PlanConfigListResponse,
    PlanConfigResponse,
    PlanConfigUpdate,
)

router = APIRouter()


@router.get("", response_model=PlatformSettingsResponse)
async def get_platform_settings(
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_platform_settings_handler(ctx.uow)


@router.patch("", response_model=PlatformSettingsResponse)
async def update_platform_settings(
    data: PlatformSettingsUpdate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_platform_settings_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.get("/plans", response_model=PlanConfigListResponse)
async def get_plan_configs(
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_plan_configs_handler(ctx.uow)


@router.patch("/plans/{plan_type}", response_model=PlanConfigResponse)
async def update_plan_config(
    plan_type: str,
    data: PlanConfigUpdate,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await update_plan_config_handler(
        plan_type=plan_type,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
