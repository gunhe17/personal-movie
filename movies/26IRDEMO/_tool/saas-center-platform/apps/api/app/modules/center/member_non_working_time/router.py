from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from .schemas import (
    MemberNonWorkingTimeCreate,
    MemberNonWorkingTimeUpdate,
    MemberNonWorkingTimeResponse,
    MemberNonWorkingTimeListResponse,
    MemberNonWorkingTimeReason,
)
from .handlers import (
    create_member_non_working_time_handler,
    get_member_non_working_time_handler,
    list_member_non_working_times_handler,
    update_member_non_working_time_handler,
    delete_member_non_working_time_handler,
)

router = APIRouter(prefix="/centers/{center_id}/members/{member_id}/non-working-times", tags=["Centers - Members - Non-Working Time"])


@router.post(
    "/",
    status_code=201,
    response_model=MemberNonWorkingTimeResponse,
)
async def create_member_non_working_time(
    center_id: str,  # Path parameter (from /centers/{center_id}/members/{member_id}/non-working-times)
    member_id: str,  # Path parameter
    data: MemberNonWorkingTimeCreate,
    confirm: bool = False,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER),
            dispatch_events(),
        )
    ),
):
    return await create_member_non_working_time_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=member_id,
        data=data,
        confirm=confirm,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=MemberNonWorkingTimeListResponse,
)
async def list_member_non_working_times(
    center_id: str,  # Path parameter
    member_id: str,  # Path parameter
    year: int | None = Query(None, ge=2020, le=2100, description="연도 필터"),
    reason: MemberNonWorkingTimeReason | None = None,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_member_non_working_times_handler(
        ctx.center_id, member_id, year, reason, page, size, ctx.uow
    )


@router.get(
    "/{non_working_time_id}",
    response_model=MemberNonWorkingTimeResponse,
)
async def get_member_non_working_time(
    center_id: str,  # Path parameter
    member_id: str,  # Path parameter
    non_working_time_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_member_non_working_time_handler(
        ctx.center_id, member_id, non_working_time_id, ctx.uow
    )


@router.patch(
    "/{non_working_time_id}",
    response_model=MemberNonWorkingTimeResponse,
)
async def update_member_non_working_time(
    center_id: str,  # Path parameter
    member_id: str,  # Path parameter
    non_working_time_id: str,
    data: MemberNonWorkingTimeUpdate,
    confirm: bool = False,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER),
            dispatch_events(),
        )
    ),
):
    return await update_member_non_working_time_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=member_id,
        non_working_time_id=non_working_time_id,
        data=data,
        confirm=confirm,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{non_working_time_id}",
    status_code=204,
)
async def delete_member_non_working_time(
    center_id: str,  # Path parameter
    member_id: str,  # Path parameter
    non_working_time_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER),
            dispatch_events(),
        )
    ),
):
    await delete_member_non_working_time_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=member_id,
        non_working_time_id=non_working_time_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
