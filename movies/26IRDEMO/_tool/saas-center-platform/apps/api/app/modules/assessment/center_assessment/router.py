from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query, HTTPException, status

from app.core.permissions import Permission
from .handlers import (
    list_center_assessments_handler,
    create_center_assessment_handler,
    update_center_assessment_handler,
    bulk_update_center_assessments_handler,
)
from .schemas import (
    CenterAssessmentUpdate,
    CenterAssessmentBulkUpdate,
    CenterAssessmentResponse,
    CenterAssessmentWithAssessment,
)

router = APIRouter(prefix="/centers/{center_id}/center-assessments", tags=["CenterAssessment"])


@router.get(
    "",
    response_model=list[CenterAssessmentWithAssessment],
)
async def list_center_assessments(
    search: str | None = Query(None, description="이름/코드 검색"),
    assessment_type: str | None = Query(None, description="검사 분류 필터"),
    is_active: str | None = Query(
        None,
        description="운영 상태 필터 (true/false/all)",
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CENTER_ASSESSMENT),
        )
    ),
):
    if is_active is None or is_active == "all":
        active_filter = None
    else:
        normalized = is_active.lower()
        if normalized in ("true", "1", "yes"):
            active_filter = True
        elif normalized in ("false", "0", "no"):
            active_filter = False
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid is_active value. Use true/false/all.",
            )
    return await list_center_assessments_handler(
        ctx.center_id,
        ctx.uow,
        search=search,
        assessment_type=assessment_type,
        is_active=active_filter,
    )


@router.post(
    "/{assessment_id}",
    response_model=CenterAssessmentResponse,
    status_code=201,
)
async def create_center_assessment(
    assessment_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER_ASSESSMENT),
            dispatch_events(),
        )
    ),
):
    return await create_center_assessment_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        assessment_id=assessment_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/batch",
    response_model=list[CenterAssessmentResponse],
)
async def bulk_update_center_assessments(
    data: CenterAssessmentBulkUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER_ASSESSMENT),
            dispatch_events(),
        )
    ),
):
    return await bulk_update_center_assessments_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{assessment_id}",
    response_model=CenterAssessmentResponse,
)
async def update_center_assessment(
    assessment_id: str,
    data: CenterAssessmentUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_CENTER_ASSESSMENT),
            dispatch_events(),
        )
    ),
):
    return await update_center_assessment_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        assessment_id=assessment_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
