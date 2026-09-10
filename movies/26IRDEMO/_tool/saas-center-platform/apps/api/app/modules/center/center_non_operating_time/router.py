from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
    gate,
)
from app.infrastructure.internal_auth import verify_internal_secret
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from .schemas import (
    NonOperatingTimeCreate,
    NonOperatingTimeUpdate,
    NonOperatingTimeResponse,
    RegisterCenterHolidaysResponse,
)
from .handlers import (
    create_center_non_operating_time_handler,
    get_center_non_operating_time_handler,
    list_center_non_operating_times_handler,
    update_center_non_operating_time_handler,
    delete_center_non_operating_time_handler,
    register_center_holidays_handler,
)

router = APIRouter(prefix="/centers/{center_id}/non-operating-times", tags=["Centers - Non-Operating Time"])


@router.post(
    "/",
    status_code=201,
    response_model=NonOperatingTimeResponse,
)
async def create_center_non_operating_time(
    center_id: str,  # Path parameter
    data: NonOperatingTimeCreate,
    confirm: bool = False,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER),
            dispatch_events(),
        )
    ),
):
    return await create_center_non_operating_time_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        confirm=confirm,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
        account_id=ctx.account_id,
    )


@router.get(
    "/",
    response_model=list[NonOperatingTimeResponse],
)
async def list_center_non_operating_times(
    center_id: str,  # Path parameter
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=100, description="조회할 개수"),
    active_only: bool = Query(False, description="현재 유효한 비영업시간만 조회"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_center_non_operating_times_handler(
        ctx.center_id, skip, limit, active_only, ctx.uow
    )


@router.get(
    "/{non_operating_time_id}",
    response_model=NonOperatingTimeResponse,
)
async def get_center_non_operating_time(
    center_id: str,  # Path parameter
    non_operating_time_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_center_non_operating_time_handler(
        ctx.center_id, non_operating_time_id, ctx.uow
    )


@router.patch(
    "/{non_operating_time_id}",
    response_model=NonOperatingTimeResponse,
)
async def update_center_non_operating_time(
    center_id: str,  # Path parameter
    non_operating_time_id: str,
    data: NonOperatingTimeUpdate,
    confirm: bool = False,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER),
            dispatch_events(),
        )
    ),
):
    return await update_center_non_operating_time_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        non_operating_time_id=non_operating_time_id,
        data=data,
        confirm=confirm,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


# 비영업시간 삭제
@router.delete(
    "/{non_operating_time_id}",
    status_code=204,
)
async def delete_center_non_operating_time(
    center_id: str,  # Path parameter
    non_operating_time_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER),
            dispatch_events(),
        )
    ),
):
    await delete_center_non_operating_time_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        non_operating_time_id=non_operating_time_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


# 공휴일 일괄 등록 (SYSTEM) — 플랫폼 내부/서버 자동화 전용(X-Internal-Secret). 센터 유저 차단.
@router.post(
    "/holidays",
    status_code=201,
    response_model=RegisterCenterHolidaysResponse,
)
async def register_center_holidays(
    center_id: str,
    year: int,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            gate(verify_internal_secret),
            dispatch_events(),
        ),
    ),
):
    return await register_center_holidays_handler(
        center_id,
        year,
        ctx.uow,
        event_group_id=ctx.event_group_id,
    )
