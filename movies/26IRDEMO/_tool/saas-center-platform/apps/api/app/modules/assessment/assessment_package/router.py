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
    list_packages_handler,
    get_package_handler,
    delete_package_handler,
)
from app.application.handlers.assessment.create_package import create_package_handler
from app.application.handlers.assessment.update_package import update_package_handler
from .schemas import (
    AssessmentPackageCreate,
    AssessmentPackageUpdate,
    AssessmentPackageResponse,
    AssessmentPackageListResponse,
)

router = APIRouter(prefix="/centers/{center_id}/assessment-packages", tags=["AssessmentPackage"])


@router.get(
    "",
    response_model=AssessmentPackageListResponse,
)
async def list_packages(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: str | None = Query(None, description="패키지명 검색"),
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
    return await list_packages_handler(
        ctx.center_id, page, size, ctx.uow, search, assessment_type
    )


@router.get(
    "/{package_id}",
    response_model=AssessmentPackageResponse,
)
async def get_package(
    package_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ASSESSMENT_CASE),
        )
    ),
):
    return await get_package_handler(ctx.center_id, package_id, ctx.uow)


@router.post(
    "",
    response_model=AssessmentPackageResponse,
    status_code=201,
)
async def create_package(
    data: AssessmentPackageCreate,
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
    return await create_package_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{package_id}",
    response_model=AssessmentPackageResponse,
)
async def update_package(
    package_id: str,
    data: AssessmentPackageUpdate,
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
    return await update_package_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        package_id=package_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{package_id}",
    response_model=MessageResponse,
)
async def delete_package(
    package_id: str,
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
    return await delete_package_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        package_id=package_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
