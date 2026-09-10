from fastapi import APIRouter, Depends

from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from app.core.permissions import Permission
from .schemas import CenterUpdate, CenterResponse, CenterListResponse
from ..center_application.schemas import CenterApplicationSummary  # noqa: F401
from .handlers import (
    get_center_handler,
    update_center_handler,
)

CenterListResponse.model_rebuild()

router = APIRouter(prefix="/centers", tags=["Centers"])


@router.get(
    "/",
    response_model=CenterListResponse,
)
async def list_centers(
    skip: int = 0,
    limit: int = 100,
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    from app.application.handlers.center import list_user_centers_handler

    return await list_user_centers_handler(ctx.person_id, ctx.account_id, skip, limit, ctx.uow)


@router.get(
    "/{center_id}",
    response_model=CenterResponse,
)
async def get_center(
    center_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CENTER),
        )
    ),
):
    return await get_center_handler(center_id, ctx.uow)


@router.patch(
    "/{center_id}",
    response_model=CenterResponse,
)
async def update_center(
    center_id: str,
    data: CenterUpdate,
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
    return await update_center_handler(
        event_group_id=ctx.event_group_id,
        center_id=center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
