from datetime import datetime
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
from app.core.schemas import MessageResponse
from app.application.handlers.home.schemas import PrepSignalsResponse
from .schemas import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleListItem,
    BatchScheduleValidation,
    ScheduleValidationResponse,
    SingleScheduleValidation,
    SingleScheduleValidationResponse,
    DatesScheduleValidation,
    DatesScheduleValidationResponse,
)
from .handlers import (
    delete_schedule_handler,
)
from .handlers.validate_schedule import validate_schedule_handler

router = APIRouter(prefix="/centers/{center_id}/schedules", tags=["Schedules"])


@router.post(
    "/",
    response_model=ScheduleResponse,
    status_code=201,
)
async def create_schedule(
    data: ScheduleCreate,
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
    from app.application.handlers import create_schedule_handler

    return await create_schedule_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=list[ScheduleListItem],
)
async def list_schedules(
    start: datetime = Query(...),
    end: datetime = Query(...),
    schedule_types: list[str] | None = Query(
        None, description="유형 필터 (복수, assessment/counseling/meeting/block)"
    ),
    member_ids: list[str] | None = Query(
        None, alias="member_id", description="담당자 ID 필터 (복수, manage 권한 전용)"
    ),
    client_name: str | None = Query(None),
    client_ids: list[str] | None = Query(None),
    room_id: str | None = Query(None),
    title: str | None = Query(None),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers import list_schedules_handler

    # RBAC + 드롭다운 병합 (owner_scope: None=전체, member_id=본인 + 공동 담당 참여 일정)
    resolved_member_ids = member_ids if ctx.owner_scope is None else [ctx.actor_id]

    return await list_schedules_handler(
        center_id=ctx.center_id,
        member_ids=resolved_member_ids,
        owner_scope=ctx.owner_scope,
        start=start,
        end=end,
        title=title,
        schedule_types=schedule_types,
        room_id=room_id,
        client_name=client_name,
        client_ids=client_ids,
        uow=ctx.uow,
    )


@router.get(
    "/{schedule_id}",
    response_model=ScheduleResponse,
)
async def get_schedule(
    schedule_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers import get_schedule_detail_handler

    return await get_schedule_detail_handler(
        center_id=ctx.center_id,
        schedule_id=schedule_id,
        uow=ctx.uow,
    )


@router.get(
    "/{schedule_id}/prep-signals",
    response_model=PrepSignalsResponse,
)
async def get_prep_signals(
    schedule_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers.home import get_prep_signals_handler

    return await get_prep_signals_handler(
        center_id=ctx.center_id,
        schedule_id=schedule_id,
        member_id=ctx.actor_id,
        uow=ctx.uow,
    )


@router.patch(
    "/{schedule_id}",
    response_model=ScheduleResponse,
)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
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
    from app.application.handlers import update_schedule_handler

    return await update_schedule_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        schedule_id=schedule_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{schedule_id}",
    status_code=200,
    response_model=MessageResponse,
)
async def delete_schedule(
    schedule_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_SCHEDULE),
            dispatch_events(),
        )
    ),
):
    return await delete_schedule_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        schedule_id=schedule_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/validate",
    response_model=SingleScheduleValidationResponse,
)
async def validate_schedule(
    data: SingleScheduleValidation,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    return await validate_schedule_handler(
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
    )


@router.post(
    "/validate-dates",
    response_model=DatesScheduleValidationResponse,
)
async def validate_schedule_dates(
    data: DatesScheduleValidation,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers import validate_schedule_dates_handler

    return await validate_schedule_dates_handler(
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
    )


@router.post(
    "/validate-recurring",
    response_model=ScheduleValidationResponse,
)
async def validate_recurring_schedules(
    data: BatchScheduleValidation,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_SCHEDULE),
        )
    ),
):
    from app.application.handlers import validate_recurring_schedules_handler

    return await validate_recurring_schedules_handler(
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
    )


# ─── 홈 횡단 신호 — 일정 스코프가 아니라 상담사 단위라 /schedules 밖에 마운트 ───


