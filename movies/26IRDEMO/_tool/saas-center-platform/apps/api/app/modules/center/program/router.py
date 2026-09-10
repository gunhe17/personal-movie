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
    ProgramCreate,
    ProgramUpdate,
    ProgramResponse,
    ProgramListResponse,
)
from app.application.handlers.program import (
    create_program_with_members_handler as create_program_app_handler,
    list_programs_enriched_handler as list_programs_app_handler,
)
from .handlers import (
    get_program_handler,
    update_program_handler,
    delete_program_handler,
)

router = APIRouter(prefix="/centers/{center_id}/programs", tags=["Centers - Programs"])


@router.post(
    "/",
    status_code=201,
    response_model=ProgramResponse,
)
async def create_program(
    center_id: str,
    data: ProgramCreate,
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
    return await create_program_app_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/",
    response_model=ProgramListResponse,
)
async def list_programs(
    center_id: str,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_PROGRAM),
        )
    ),
):
    return await list_programs_app_handler(ctx.center_id, page, size, ctx.uow)


@router.get(
    "/{program_id}",
    response_model=ProgramResponse,
)
async def get_program(
    center_id: str,
    program_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_PROGRAM),
        )
    ),
):
    return await get_program_handler(ctx.center_id, program_id, ctx.uow)


@router.patch(
    "/{program_id}",
    response_model=ProgramResponse,
)
async def update_program(
    center_id: str,
    program_id: str,
    data: ProgramUpdate,
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
    return await update_program_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        program_id=program_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{program_id}",
    status_code=204,
)
async def delete_program(
    center_id: str,
    program_id: str,
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
    await delete_program_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        program_id=program_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
