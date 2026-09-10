from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.schemas import MessageResponse
from app.modules.platform_admin.account.schemas import (
    AdminAccountListResponse,
    AdminAccountDetailResponse,
)
from app.modules.platform_admin.account.handlers.list_member_accounts import (
    list_member_accounts_handler,
)
from app.modules.platform_admin.account.handlers.get_member_account import (
    get_member_account_handler,
)
from app.application.handlers.account import (
    lock_member_account_handler,
    unlock_member_account_handler,
    force_logout_admin_account_handler,
)
from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS

router = APIRouter(tags=["Admin - Accounts"])


class AdminLockBody(BaseModel):
    reason: str


@router.get("/", response_model=AdminAccountListResponse)
async def list_accounts(
    search: str | None = Query(default=None, description="검색어 (이메일, 이름)"),
    is_active: bool | None = Query(default=None, description="활성 상태 필터"),
    provider: str | None = Query(
        default=None, description="가입 방식 (email, kakao, naver, google)"
    ),
    has_pending_credentials: bool | None = Query(
        default=None, description="검증 대기 자격이 있는 계정만"
    ),
    page: int = Query(default=1, ge=1, description="페이지 번호"),
    size: int = Query(default=20, ge=1, le=100, description="페이지 크기"),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_member_accounts_handler(
        ctx.uow,
        search=search,
        is_active=is_active,
        provider=provider,
        has_pending_credentials=has_pending_credentials,
        page=page,
        size=size,
    )


@router.get("/{account_id}", response_model=AdminAccountDetailResponse)
async def get_account(
    account_id: str,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await get_member_account_handler(account_id, ctx.uow)


@router.post("/{account_id}/lock", response_model=MessageResponse)
async def lock_account(
    account_id: str,
    body: AdminLockBody,
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
    return await lock_member_account_handler(
        account_id=account_id,
        reason=body.reason,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post("/{account_id}/unlock", response_model=MessageResponse)
async def unlock_account(
    account_id: str,
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
    return await unlock_member_account_handler(
        account_id=account_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post("/{account_id}/force-logout", response_model=MessageResponse)
async def force_logout(
    account_id: str,
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
    return await force_logout_admin_account_handler(
        account_id=account_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )
