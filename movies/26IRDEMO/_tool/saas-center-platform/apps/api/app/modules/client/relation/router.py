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
from .handlers import (
    create_relation_handler,
    list_relations_handler,
    delete_relation_handler,
)
from .schemas import (
    RelationCreateRequest,
    RelationResponse,
)

router = APIRouter(prefix="/centers/{center_id}/clients", tags=["client-relation"])


@router.post(
    "/{client_id}/relations",
    response_model=RelationResponse,
    status_code=201,
)
async def create_relation(
    client_id: str,
    data: RelationCreateRequest,
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
    return await create_relation_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        client_id=client_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/{client_id}/relations",
    response_model=list[RelationResponse],
)
async def list_relations(
    client_id: str,
    relation_category: str | None = Query(None, description="필터 (guardian, sibling)"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CLIENT),
        )
    ),
):
    return await list_relations_handler(
        ctx.center_id, client_id, ctx.uow, relation_category
    )


@router.delete(
    "/relations/{relation_id}",
    status_code=200,
    response_model=RelationResponse,
)
async def delete_relation(
    relation_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_CLIENT),
            dispatch_events(),
        )
    ),
):
    return await delete_relation_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        relation_id=relation_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
