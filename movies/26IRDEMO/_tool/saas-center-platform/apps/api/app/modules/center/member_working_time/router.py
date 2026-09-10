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
    MemberWorkingTimeBulkCreate,
    MemberWorkingTimeResponse,
    WorkingStatusSlotsResponse,
    WorkingStatusSlotResponse,
)
from .handlers import (
    list_member_working_times_handler,
    bulk_update_member_working_times_handler,
    get_working_status_handler,
)

router = APIRouter(prefix="/centers/{center_id}/members/{member_id}/working-times", tags=["Centers - Members - Working Time"])


# 멤버 근무시간 목록 조회 (7일 전체)
@router.get(
    "/",
    response_model=list[MemberWorkingTimeResponse],
)
async def list_member_working_times(
    member_id: str,  # Path parameter (from /members/{member_id}/working-times)
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_member_working_times_handler(ctx.center_id, member_id, ctx.uow)


# 멤버 근무시간 일괄 수정 (7일 전체)
@router.put(
    "/",
    response_model=list[MemberWorkingTimeResponse],
)
async def bulk_update_member_working_times(
    member_id: str,  # Path parameter
    data: MemberWorkingTimeBulkCreate,
    confirm: bool = Query(False, description="영향받는 일정 확인"),
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
    return await bulk_update_member_working_times_handler(
        ctx.center_id,
        member_id,
        data,
        confirm,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


# 멤버 근무 상태 조회 (date 필수, slot 선택)
@router.get(
    "/status",
    response_model=WorkingStatusSlotsResponse | WorkingStatusSlotResponse,
)
async def get_working_status(
    member_id: str,  # Path parameter
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
    return await get_working_status_handler(
        ctx.center_id, member_id, date_obj, slot, ctx.uow
    )
