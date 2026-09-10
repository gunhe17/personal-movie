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
from app.modules.platform_admin.center_application.schemas import (
    AdminApplicationListResponse,
    AdminApplicationDetailResponse,
    ApproveApplicationResponse,
)
from app.modules.platform_admin.center_application.handlers.list_admin_applications import (
    list_admin_applications_handler,
)
from app.modules.platform_admin.center_application.handlers.get_admin_application import (
    get_admin_application_handler,
)
from app.application.handlers.center_application.approve_admin_application import (
    approve_admin_application_handler,
)
from app.application.handlers.center_application.reject_admin_application import (
    reject_admin_application_handler,
    AdminRejectBody,
)
from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS

router = APIRouter(tags=["Admin - Center Applications"])


@router.get(
    "/",
    response_model=AdminApplicationListResponse,
)
async def list_applications(
    status: str | None = Query(
        default=None, description="상태 필터 (pending, approved, rejected)"
    ),
    search: str | None = Query(default=None, description="검색어 (센터명, 신청자명)"),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_admin_applications_handler(
        ctx.uow,
        status=status,
        search=search,
        page=page,
        size=size,
    )


@router.get(
    "/{application_id}",
    response_model=AdminApplicationDetailResponse,
)
async def get_application(
    application_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_admin_application_handler(application_id, ctx.uow)


@router.post(
    "/{application_id}/approve",
    response_model=ApproveApplicationResponse,
)
async def approve_application(
    application_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            start_event_group(),
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            dispatch_events(),
        )
    ),
):
    return await approve_admin_application_handler(
        application_id=application_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{application_id}/reject",
    response_model=MessageResponse,
)
async def reject_application(
    application_id: str,
    body: AdminRejectBody,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            start_event_group(),
            authenticate_admin(),
            require_role(*ADMIN_PLUS),
            dispatch_events(),
        )
    ),
):
    return await reject_admin_application_handler(
        application_id=application_id,
        body=body,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
