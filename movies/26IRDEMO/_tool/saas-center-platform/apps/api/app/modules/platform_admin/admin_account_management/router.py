from app.behavior import (
    behavior,
    AdminContext,
    UnscopedContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query, Request

from app.core.schemas import MessageResponse
from app.modules.platform_admin.auth.dependencies import SUPER_PLUS
from app.modules.platform_admin.admin_account_management.schemas import (
    AdminAccountListResponse,
    AdminAccountDetail,
    InviteAdminAccountRequest,
    InviteAdminAccountResponse,
    AcceptInvitationRequest,
    UpdateAdminAccountRoleRequest,
)
from app.modules.platform_admin.admin_account_management.handlers.list_admin_accounts import (
    list_admin_accounts_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.get_admin_account import (
    get_admin_account_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.invite_admin_account import (
    invite_admin_account_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.accept_admin_invitation import (
    accept_admin_invitation_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.update_admin_account import (
    update_admin_account_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.lock_admin_account import (
    lock_admin_account_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.unlock_admin_account import (
    unlock_admin_account_handler,
)
from app.modules.platform_admin.admin_account_management.handlers.delete_admin_account import (
    delete_admin_account_handler,
)

router = APIRouter(tags=["Admin - Admin Account Management"])


@router.get(
    "/",
    response_model=AdminAccountListResponse,
)
async def list_admin_accounts(
    search: str | None = Query(default=None, description="이름 또는 이메일 검색"),
    role: str | None = Query(default=None, description="역할 필터"),
    is_active: bool | None = Query(default=None, description="활성 상태 필터"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
        )
    ),
):
    return await list_admin_accounts_handler(
        ctx.uow, search=search, role=role, is_active=is_active, page=page, size=size
    )


@router.post(
    "/invite",
    response_model=InviteAdminAccountResponse,
)
async def invite_admin_account(
    data: InviteAdminAccountRequest,
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
    return await invite_admin_account_handler(
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/accept-invitation",
    response_model=MessageResponse,
)
async def accept_invitation(
    data: AcceptInvitationRequest,
    request: Request,
    *,
    # 이메일 링크 직수락(비로그인) — 신원 검증은 핸들러의 초대 토큰이 담당 (결정 U9)
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await accept_admin_invitation_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        ip=request.client.host if request.client else None,
    )


@router.get(
    "/{account_id}",
    response_model=AdminAccountDetail,
)
async def get_admin_account(
    account_id: str,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            require_role(*SUPER_PLUS),
        )
    ),
):
    return await get_admin_account_handler(account_id, ctx.uow)


@router.patch(
    "/{account_id}",
    response_model=AdminAccountDetail,
)
async def update_admin_account(
    account_id: str,
    data: UpdateAdminAccountRoleRequest,
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
    return await update_admin_account_handler(
        account_id=account_id,
        data=data,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{account_id}/lock",
    response_model=MessageResponse,
)
async def lock_admin_account(
    account_id: str,
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
    return await lock_admin_account_handler(
        account_id=account_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{account_id}/unlock",
    response_model=MessageResponse,
)
async def unlock_admin_account(
    account_id: str,
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
    return await unlock_admin_account_handler(
        account_id=account_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.delete(
    "/{account_id}",
    response_model=MessageResponse,
)
async def delete_admin_account(
    account_id: str,
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
    return await delete_admin_account_handler(
        account_id=account_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
