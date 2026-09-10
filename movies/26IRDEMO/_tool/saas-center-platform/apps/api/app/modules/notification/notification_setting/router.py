from fastapi import APIRouter, Depends, status

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    start_event_group,
    dispatch_events,
)

from .handlers import (
    list_settings_handler,
    upsert_setting_handler,
    delete_setting_handler,
)
from .schemas import (
    NotificationSettingUpsert,
    NotificationSettingResponse,
    NotificationSettingListResponse,
)

router = APIRouter(
    prefix="/centers/{center_id}/notification-settings",
    tags=["NotificationSetting"],
)


@router.get(
    "",
    response_model=NotificationSettingListResponse,
)
async def list_settings(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_settings_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
    )


@router.put(
    "",
    response_model=NotificationSettingResponse,
)
async def upsert_setting(
    data: NotificationSettingUpsert,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    return await upsert_setting_handler(
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{setting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_setting(
    setting_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    await delete_setting_handler(
        setting_id=setting_id,
        center_id=ctx.center_id,
        account_id=ctx.account_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
