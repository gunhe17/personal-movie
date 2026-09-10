from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.modules.platform_admin.auth.dependencies import (
    ADMIN_PLUS,
    SUPER_PLUS,
)
from app.modules.center.center.schemas import CenterCreate, CenterResponse
from app.modules.platform_admin.center.schemas import (
    AdminCenterListResponse,
    AdminCenterDetailResponse,
    AdminCenterClientListResponse,
    AdminCenterActionResponse,
    CenterSuspendRequest,
    CenterWarnRequest,
    CenterTerminateRequest,
    TerminatedCenterListResponse,
    CenterSubscriptionTabResponse,
)
from app.modules.platform_admin.center.handlers.list_admin_centers import (
    list_admin_centers_handler,
)
from app.modules.platform_admin.center.handlers.get_admin_center import (
    get_admin_center_handler,
)
from app.modules.platform_admin.center.handlers.list_center_clients import (
    list_center_clients_handler,
)
from app.application.handlers.center import (
    create_center_handler,
    suspend_center_handler,
    activate_center_handler,
    restore_center_handler,
    terminate_center_handler,
)
from app.application.handlers.center.warn_center import warn_center_handler
from app.modules.platform_admin.center.handlers.list_terminated_centers import (
    list_terminated_centers_handler,
)
from app.application.handlers.subscription.get_center_subscription_tab import (
    get_center_subscription_tab_handler,
)

router = APIRouter(tags=["Admin - Centers"])


@router.post("/", response_model=CenterResponse, status_code=201)
async def create_center(
    data: CenterCreate,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await create_center_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
    )


@router.get("/", response_model=AdminCenterListResponse)
async def list_centers(
    status: str | None = Query(
        default=None, description="상태 필터 (active, suspended)"
    ),
    search: str | None = Query(default=None, description="검색어 (센터명, 사업자번호)"),
    sort_by: str = Query(
        default="created_at", description="정렬 (created_at, name, member_count)"
    ),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_admin_centers_handler(
        ctx.uow,
        status=status,
        search=search,
        sort_by=sort_by,
        page=page,
        size=size,
    )


@router.get("/terminated", response_model=TerminatedCenterListResponse)
async def list_terminated_centers(
    status: str | None = Query(
        default=None, description="상태 필터 (retention, expired, all)"
    ),
    search: str | None = Query(default=None, description="검색어 (센터명, 사업자번호)"),
    expiring_soon: bool = Query(default=False, description="만료 임박 (7일 이내)"),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_terminated_centers_handler(
        ctx.uow,
        status=status,
        search=search,
        expiring_soon=expiring_soon,
        page=page,
        size=size,
    )


@router.get("/{center_id}", response_model=AdminCenterDetailResponse)
async def find_center(
    center_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_admin_center_handler(center_id, ctx.uow)


@router.get("/{center_id}/clients", response_model=AdminCenterClientListResponse)
async def list_center_clients(
    center_id: str,
    status: str | None = Query(
        default=None, description="상태 필터 (active, inactive, archived)"
    ),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=10, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_center_clients_handler(
        center_id, ctx.uow, status=status, page=page, size=size
    )


@router.get(
    "/{center_id}/subscription-tab", response_model=CenterSubscriptionTabResponse
)
async def get_center_subscription_tab(
    center_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await get_center_subscription_tab_handler(
        center_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.admin_account_id,
    )


@router.post(
    "/{center_id}/suspend",
    response_model=AdminCenterActionResponse,
)
async def suspend_center(
    center_id: str,
    data: CenterSuspendRequest,
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
    return await suspend_center_handler(
        center_id=center_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/activate",
    response_model=AdminCenterActionResponse,
)
async def activate_center(
    center_id: str,
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
    return await activate_center_handler(
        center_id=center_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/warn",
    response_model=AdminCenterActionResponse,
)
async def warn_center(
    center_id: str,
    data: CenterWarnRequest,
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
    return await warn_center_handler(
        center_id=center_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/restore",
    response_model=AdminCenterActionResponse,
)
async def restore_center(
    center_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await restore_center_handler(
        center_id=center_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{center_id}/terminate",
    response_model=AdminCenterActionResponse,
)
async def terminate_center(
    center_id: str,
    data: CenterTerminateRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await terminate_center_handler(
        center_id=center_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
