from fastapi import APIRouter, Depends, Query, status

from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from app.core.permissions import Permission
from .handlers import (
    assign_role_permissions_handler,
    get_role_permissions_handler,
    create_role_handler,
    update_role_handler,
)
from .schemas import RolePermissionAssign, RolePermissionsResponse
from ..role.schemas import RoleCreate, RoleUpdate
from app.application.handlers.role.list_center_roles import list_center_roles_handler
from app.application.handlers.role.delete_role import delete_role_handler
from app.application.handlers.role.assign_role_members import (
    assign_role_members_handler,
)
from app.application.handlers.role.list_role_members import list_role_members_handler
from app.application.handlers.role.schemas import (
    RoleSummaryWithCount,
    AssignRoleMembersRequest,
    AssignRoleMembersResponse,
    RoleMemberListResponse,
)

router = APIRouter(tags=["Centers - Role Permissions"])


@router.get(
    "/",
    response_model=list[RoleSummaryWithCount],
)
async def list_center_roles(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ROLE),
        )
    ),
):
    return await list_center_roles_handler(ctx.center_id, ctx.uow)


# 권한 조회/설정 (정적 경로 — 동적 경로보다 먼저 등록)


@router.get(
    "/{role_code}/permissions",
    response_model=RolePermissionsResponse,
)
async def get_role_permissions(
    role_code: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ROLE),
        )
    ),
):
    return await get_role_permissions_handler(ctx.center_id, role_code, ctx.uow)


@router.put(
    "/{role_code}/permissions",
    response_model=RolePermissionsResponse,
)
async def assign_role_permissions(
    role_code: str,
    data: RolePermissionAssign,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROLE),
            dispatch_events(),
        )
    ),
):
    return await assign_role_permissions_handler(
        ctx.center_id,
        role_code,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/",
    response_model=RolePermissionsResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_role(
    data: RoleCreate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROLE),
            dispatch_events(),
        )
    ),
):
    return await create_role_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.patch(
    "/{role_code}",
    response_model=RolePermissionsResponse,
)
async def update_role(
    role_code: str,
    data: RoleUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROLE),
            dispatch_events(),
        )
    ),
):
    return await update_role_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        role_code=role_code,
        data=data,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.delete(
    "/{role_code}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_role(
    role_code: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROLE),
            dispatch_events(),
        )
    ),
):
    await delete_role_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        role_code=role_code,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "/{role_code}/members",
    response_model=RoleMemberListResponse,
)
async def list_role_members(
    role_code: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, description="이름 검색"),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ROLE),
        )
    ),
):
    return await list_role_members_handler(
        ctx.center_id, role_code, page, size, ctx.uow, search
    )


@router.post(
    "/{role_code}/members/batch-assign",
    response_model=AssignRoleMembersResponse,
)
async def batch_assign_role_members(
    role_code: str,
    data: AssignRoleMembersRequest,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_ROLE),
            dispatch_events(),
        )
    ),
):
    return await assign_role_members_handler(
        ctx.center_id,
        role_code,
        data.member_ids,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
