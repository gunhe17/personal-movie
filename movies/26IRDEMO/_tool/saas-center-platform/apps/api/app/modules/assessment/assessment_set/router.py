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
from app.core.schemas import MessageResponse
from .handlers import (
    list_sets_handler,
    get_set_handler,
    delete_set_handler,
)
from app.application.handlers.assessment.create_set import create_set_handler
from app.application.handlers.assessment.update_set import update_set_handler
from .schemas import (
    AssessmentSetCreate,
    AssessmentSetUpdate,
    AssessmentSetResponse,
    AssessmentSetListResponse,
)

router = APIRouter(prefix="/centers/{center_id}/assessment-sets", tags=["AssessmentSet"])


@router.get(
    "",
    response_model=AssessmentSetListResponse,
)
async def list_sets(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: str | None = Query(None, description="세트명 검색"),
    assessment_type: str | None = Query(
        None,
        description="검사 분류 필터 (projective, intelligence, objective, developmental)",
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await list_sets_handler(
        ctx.center_id, page, size, ctx.uow, search, assessment_type
    )


@router.get(
    "/{set_id}",
    response_model=AssessmentSetResponse,
)
async def get_set(
    set_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await get_set_handler(ctx.center_id, set_id, ctx.uow)


@router.post(
    "",
    response_model=AssessmentSetResponse,
    status_code=201,
)
async def create_set(
    data: AssessmentSetCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await create_set_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{set_id}",
    response_model=AssessmentSetResponse,
)
async def update_set(
    set_id: str,
    data: AssessmentSetUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await update_set_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        set_id=set_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{set_id}",
    response_model=MessageResponse,
)
async def delete_set(
    set_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_ASSESSMENT_CASE),
            dispatch_events(),
        )
    ),
):
    return await delete_set_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        set_id=set_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
