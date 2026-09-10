from app.behavior import behavior, AdminContext, UnscopedContext, authenticate_admin, start_event_group, dispatch_events
from fastapi import APIRouter, Depends, Request
from starlette.background import BackgroundTasks

from app.modules.platform_admin.auth.schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminRefreshRequest,
    AdminRefreshResponse,
    AdminTokenResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    Verify2FARequest,
)
from app.modules.platform_admin.auth.handlers.admin_login import admin_login_handler
from app.modules.platform_admin.auth.handlers.admin_verify_2fa import admin_verify_2fa_handler
from app.modules.platform_admin.auth.handlers.admin_refresh import admin_refresh_handler
from app.modules.platform_admin.auth.handlers.change_admin_password import (
    change_admin_password_handler,
)

router = APIRouter(tags=["Admin Auth"])


@router.post(
    "/login",
    response_model=AdminLoginResponse,
)
async def admin_login(
    data: AdminLoginRequest,
    *,
    request: Request,
    background_tasks: BackgroundTasks,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await admin_login_handler(data, request, ctx.uow, background_tasks)


@router.post(
    "/verify-2fa",
    response_model=AdminTokenResponse,
)
async def admin_verify_2fa(
    data: Verify2FARequest,
    *,
    request: Request,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        ),
    ),
):
    return await admin_verify_2fa_handler(
        data,
        request,
        ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.post(
    "/refresh",
    response_model=AdminRefreshResponse,
)
async def admin_refresh(
    data: AdminRefreshRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await admin_refresh_handler(data, ctx.uow)


@router.post(
    "/change-password",
    response_model=ChangePasswordResponse,
)
async def admin_change_password(
    data: ChangePasswordRequest,
    *,
    ctx: AdminContext = Depends(
        behavior.request_admin(
            authenticate_admin(),
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await change_admin_password_handler(
        data,
        ctx.admin_account_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        ip=ctx.ip,
    )
