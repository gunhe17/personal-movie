from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends

from app.core.permissions import Permission
from .schemas import (
    ProgramMemberAssign,
    ProgramMemberListResponse,
)
from .handlers import (
    assign_members_handler,
    unassign_member_handler,
    list_program_members_handler,
)

router = APIRouter(prefix="/centers/{center_id}/programs/{program_id}/members", tags=["Centers - Program Members"])


@router.post(
    "/",
    status_code=201,
    response_model=ProgramMemberListResponse,
)
async def assign_members(
    center_id: str,
    program_id: str,
    data: ProgramMemberAssign,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_PROGRAM),
            dispatch_events(),
        )
    ),
):
    return await assign_members_handler(
        ctx.center_id,
        program_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=ProgramMemberListResponse,
)
async def list_program_members(
    center_id: str,
    program_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await list_program_members_handler(ctx.center_id, program_id, ctx.uow)


@router.delete(
    "/{member_id}",
    status_code=204,
)
async def unassign_member(
    center_id: str,
    program_id: str,
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_PROGRAM),
            dispatch_events(),
        )
    ),
):
    await unassign_member_handler(
        ctx.center_id,
        program_id,
        member_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
