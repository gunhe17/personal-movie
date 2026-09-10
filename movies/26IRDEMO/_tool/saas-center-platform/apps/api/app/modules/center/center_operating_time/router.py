from datetime import date as date_type
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
    OperatingTimeBulkCreate,
    OperatingTimeSummary,
    OperatingTimeResponse,
    OperatingStatusSlotsResponse,
    OperatingStatusSlotResponse,
)
from .handlers import (
    list_center_operating_times_handler,
    bulk_update_center_operating_times_handler,
    get_operating_status_handler,
)

router = APIRouter(prefix="/centers/{center_id}/operating-times", tags=["Centers - Operating Time"])


# 영업시간 조회 (7일 전체)
@router.get(
    "/",
    response_model=list[OperatingTimeSummary],
)
async def list_center_operating_times(
    center_id: str,  # Path parameter (from /centers/{center_id}/operating-times)
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_center_operating_times_handler(ctx.center_id, ctx.uow)


# 영업시간 일괄 수정 (7일 전체)
@router.put(
    "/",
    response_model=list[OperatingTimeResponse],
)
async def bulk_update_center_operating_times(
    center_id: str,  # Path parameter
    data: OperatingTimeBulkCreate,
    confirm: bool = Query(False, description="영향받는 일정 확인"),
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
    return await bulk_update_center_operating_times_handler(
        ctx.center_id,
        data,
        confirm,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


# 영업 상태 조회 (date 필수, slot 선택)
@router.get(
    "/status",
    response_model=OperatingStatusSlotsResponse | OperatingStatusSlotResponse,
)
async def get_operating_status(
    center_id: str,  # Path parameter
    date: str = Query(..., description="조회 날짜 (YYYY-MM-DD)"),
    slot: str | None = Query(None, description="슬롯 (HH:MM)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    date_obj = date_type.fromisoformat(date)
    return await get_operating_status_handler(ctx.center_id, date_obj, slot, ctx.uow)
