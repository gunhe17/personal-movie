from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, status

from app.core.permissions import Permission
from .handlers import (
    add_favorite_handler,
    remove_favorite_handler,
)
from app.application.handlers.client import list_favorites_handler
from .schemas import ClientFavoriteResponse, ClientFavoriteListResponse


router = APIRouter(prefix="/centers/{center_id}/clients", tags=["client-favorite"])


@router.get(
    "/favorites",
    response_model=ClientFavoriteListResponse,
)
async def list_favorites(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await list_favorites_handler(ctx.person_id, ctx.center_id, ctx.uow)


@router.post(
    "/{client_id}/favorite",
    response_model=ClientFavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_favorite(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await add_favorite_handler(
        ctx.person_id,
        client_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{client_id}/favorite",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_favorite(
    client_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
            dispatch_events(),
        )
    ),
):
    await remove_favorite_handler(
        ctx.person_id,
        client_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        actor_id=ctx.actor_id,
    )
