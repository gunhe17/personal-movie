from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Body, Query, Depends

from app.core.permissions import Permission
from .handlers import (
    create_link_request_handler,
    approve_link_request_handler,
    reject_link_request_handler,
    list_link_requests_handler,
)
from .schemas import (
    ClientLinkRequestCreate,
    ClientLinkRequestResponse,
    ClientLinkRequestListResponse,
)

router = APIRouter(prefix="/centers/{center_id}/clients/link-requests", tags=["client-link"])


@router.get(
    "/",
    response_model=ClientLinkRequestListResponse,
)
async def list_link_requests(
    status: str | None = Query(
        None, description="상태 필터 (pending, approved, rejected)"
    ),
    skip: int = Query(0, ge=0, description="건너뛸 개수"),
    limit: int = Query(100, ge=1, le=1000, description="최대 개수"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
        )
    ),
):
    return await list_link_requests_handler(
        ctx.center_id, ctx.owner_scope, status, skip, limit, ctx.uow
    )


@router.post(
    "",
    status_code=201,
    response_model=ClientLinkRequestResponse,
)
async def create_link_request(
    data: ClientLinkRequestCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await create_link_request_handler(
        event_group_id=ctx.event_group_id,
        data=data,
        center_id=ctx.center_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{request_id}/approve",
    response_model=ClientLinkRequestResponse,
)
async def approve_link_request(
    request_id: str,
    client_id: str = Body(..., embed=True, description="연동할 Client UUID"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await approve_link_request_handler(
        request_id,
        client_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{request_id}/reject",
    response_model=ClientLinkRequestResponse,
)
async def reject_link_request(
    request_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await reject_link_request_handler(
        request_id,
        ctx.center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
