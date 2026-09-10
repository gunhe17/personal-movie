from fastapi import APIRouter, Depends, Query
from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from app.core.permissions import Permission
from .schemas import (
    ScheduleChangeRequestReject,
    ScheduleChangeRequestResponse,
    ScheduleChangeRequestSummary,
)

change_request_router = APIRouter(
    prefix="/centers/{center_id}/schedule-change-requests", tags=["Schedules"]
)


@change_request_router.get(
    "",
    response_model=list[ScheduleChangeRequestSummary],
)
async def list_schedule_change_requests(
    status: str | None = Query(None, description="pending | approved | rejected"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers import list_schedule_change_requests_handler

    return await list_schedule_change_requests_handler(
        center_id=ctx.center_id,
        status=status,
        uow=ctx.uow,
    )


@change_request_router.post(
    "/{request_id}/approve",
    response_model=ScheduleChangeRequestResponse,
)
async def approve_schedule_change(
    request_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_SCHEDULE),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers import approve_schedule_change_handler

    return await approve_schedule_change_handler(
        center_id=ctx.center_id,
        request_id=request_id,
        actor_member_id=ctx.actor_id,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@change_request_router.post(
    "/{request_id}/reject",
    response_model=ScheduleChangeRequestResponse,
)
async def reject_schedule_change(
    request_id: str,
    data: ScheduleChangeRequestReject,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_SCHEDULE),
            dispatch_events(),
        )
    ),
):
    from app.application.handlers import reject_schedule_change_handler

    return await reject_schedule_change_handler(
        center_id=ctx.center_id,
        request_id=request_id,
        reason=data.reason,
        actor_member_id=ctx.actor_id,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
