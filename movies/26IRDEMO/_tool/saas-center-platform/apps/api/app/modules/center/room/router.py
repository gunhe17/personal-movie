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
from .schemas import RoomCreate, RoomUpdate, RoomResponse, RoomSummary
from .handlers import (
    create_room_handler,
    get_room_handler,
    list_rooms_handler,
    update_room_handler,
    delete_room_handler,
)

router = APIRouter(prefix="/centers/{center_id}/rooms", tags=["Centers - Rooms"])


@router.post(
    "/",
    status_code=201,
    response_model=RoomResponse,
)
async def create_room(
    center_id: str,
    data: RoomCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROOM),
            dispatch_events(),
        )
    ),
):
    return await create_room_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=list[RoomSummary],
)
async def list_rooms(
    center_id: str,
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=100, description="조회할 개수"),
    active_only: bool = Query(False, description="활성 상담실만 조회"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ROOM),
        )
    ),
):
    return await list_rooms_handler(ctx.center_id, skip, limit, active_only, ctx.uow)


@router.get(
    "/{room_id}",
    response_model=RoomResponse,
)
async def get_room(
    center_id: str,
    room_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ROOM),
        )
    ),
):
    return await get_room_handler(ctx.center_id, room_id, ctx.uow)


@router.patch(
    "/{room_id}",
    response_model=RoomResponse,
)
async def update_room(
    center_id: str,
    room_id: str,
    data: RoomUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROOM),
            dispatch_events(),
        )
    ),
):
    return await update_room_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        room_id=room_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{room_id}",
    status_code=204,
)
async def delete_room(
    center_id: str,
    room_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROOM),
            dispatch_events(),
        )
    ),
):
    await delete_room_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        room_id=room_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
