from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS
from app.modules.platform_admin.assessment.schemas import (
    AdminAssessmentListResponse,
    AdminAssessmentDetailResponse,
    AdminAssessmentCreateRequest,
    AdminAssessmentUpdateRequest,
)
from app.modules.platform_admin.assessment.handlers.list_admin_assessments import (
    list_admin_assessments_handler,
)
from app.modules.platform_admin.assessment.handlers.get_admin_assessment import (
    get_admin_assessment_handler,
)
from app.application.handlers.assessment import (
    create_admin_assessment_handler,
    update_admin_assessment_handler,
)

router = APIRouter(tags=["Admin - Assessments"])


@router.get("/", response_model=AdminAssessmentListResponse)
async def list_assessments(
    search: str | None = Query(default=None, description="검색어 (검사명, 코드)"),
    status: str | None = Query(
        default=None, description="상태 필터 (public, private, draft)"
    ),
    assessment_type: str | None = Query(default=None, description="유형 필터"),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_admin_assessments_handler(
        ctx.uow,
        search=search,
        status=status,
        assessment_type=assessment_type,
        page=page,
        size=size,
    )


@router.get("/{assessment_id}", response_model=AdminAssessmentDetailResponse)
async def find_assessment(
    assessment_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_admin_assessment_handler(assessment_id, ctx.uow)


@router.post("/", response_model=AdminAssessmentDetailResponse)
async def create_assessment(
    data: AdminAssessmentCreateRequest,
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
    return await create_admin_assessment_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.patch(
    "/{assessment_id}",
    response_model=AdminAssessmentDetailResponse,
)
async def update_assessment(
    assessment_id: str,
    data: AdminAssessmentUpdateRequest,
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
    return await update_admin_assessment_handler(
        assessment_id=assessment_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
