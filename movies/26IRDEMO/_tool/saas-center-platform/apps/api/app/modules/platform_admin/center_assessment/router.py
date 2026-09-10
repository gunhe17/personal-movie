from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.schemas import MessageResponse
from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS
from app.modules.assessment.center_assessment.schemas import (
    CenterAssessmentWithAssessment,
    CenterAssessmentResponse,
)
from app.modules.platform_admin.assessment.schemas import AdminAssessmentSummary
from app.modules.platform_admin.center_assessment.schemas import (
    AssignAssessmentRequest,
    ToggleAssessmentRequest,
)
from app.modules.platform_admin.center_assessment.handlers.list_admin_center_assessments import (
    list_admin_center_assessments_handler,
)
from app.modules.platform_admin.center_assessment.handlers.list_unassigned import (
    list_unassigned_handler,
)
from app.application.handlers.center_assessment import (
    assign_assessment_handler,
    toggle_assessment_handler,
    unassign_assessment_handler,
)

router = APIRouter(tags=["Admin - Center Assessments"])


@router.get(
    "/",
    response_model=list[CenterAssessmentWithAssessment],
)
async def list_assessments(
    center_id: str,
    search: str | None = Query(default=None, description="검색어 (검사명, 코드)"),
    is_active: bool | None = Query(default=None, description="활성 상태 필터"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_admin_center_assessments_handler(center_id, ctx.uow, search, is_active)


@router.get(
    "/unassigned",
    response_model=list[AdminAssessmentSummary],
)
async def list_unassigned(
    center_id: str,
    search: str | None = Query(default=None, description="검색어 (검사명, 코드)"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_unassigned_handler(center_id, ctx.uow, search)


@router.post(
    "/",
    response_model=CenterAssessmentResponse,
    status_code=201,
)
async def assign_assessment(
    center_id: str,
    data: AssignAssessmentRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await assign_assessment_handler(
        center_id=center_id,
        assessment_id=data.assessment_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.patch(
    "/{assessment_id}",
    response_model=CenterAssessmentResponse,
)
async def toggle_assessment(
    center_id: str,
    assessment_id: str,
    data: ToggleAssessmentRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await toggle_assessment_handler(
        center_id=center_id,
        assessment_id=assessment_id,
        is_active=data.is_active,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete(
    "/{assessment_id}",
    response_model=MessageResponse,
)
async def unassign_assessment(
    center_id: str,
    assessment_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await unassign_assessment_handler(
        center_id=center_id,
        assessment_id=assessment_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
