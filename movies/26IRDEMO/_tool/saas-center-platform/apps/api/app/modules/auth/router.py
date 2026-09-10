from fastapi import APIRouter, Depends, Request

from app.behavior import (
    behavior,
    UnscopedContext,
    authenticate,
    start_event_group,
    dispatch_events,
)
from .handlers import (
    get_email_availability_handler,
)
from app.application.handlers.auth import (
    signup_handler,
    withdraw_handler,
    login_handler,
    refresh_token_handler,
    get_me_handler,
)
from .password_history.handlers import change_password_handler
from .token.handlers import list_devices_handler, revoke_device_handler
from .schemas import (
    SignupRequest,
    LoginRequest,
    RefreshTokenRequest,
    SignupResponse,
    LoginResponse,
    MeResponse,
)
from .account.schemas import VerifyPasswordRequest, VerifyPasswordResponse
from .password_history.schemas import ChangePasswordRequest, ChangePasswordResponse
from .token.schemas import (
    DeviceSessionListResponse,
    RevokeDeviceRequest,
    RevokeDeviceResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=201, response_model=SignupResponse)
async def signup(
    data: SignupRequest,
    *,
    request: Request,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        ),
    ),
):
    return await signup_handler(
        data,
        request,
        ctx.uow,
        event_group_id=ctx.event_group_id,
    )


@router.get("/email-availability", response_model=dict)
async def get_email_availability(
    email: str,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await get_email_availability_handler(email, ctx.uow)


@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    *,
    request: Request,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            dispatch_events(),
        )
    ),
):
    return await login_handler(
        data, request, ctx.uow, event_group_id=ctx.event_group_id
    )


@router.post(
    "/refresh",
    response_model=LoginResponse,
)
async def refresh_token(
    data: RefreshTokenRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(),
    ),
):
    return await refresh_token_handler(data, ctx.uow)


@router.get("/me", response_model=MeResponse)
async def me(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
        )
    ),
):
    return await get_me_handler(
        account_id=ctx.account_id,
        uow=ctx.uow,
    )


@router.post("/verify-password", response_model=VerifyPasswordResponse)
async def verify_password(
    data: VerifyPasswordRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
        )
    ),
):
    from .facade.auth_facade import AuthFacade

    async with ctx.uow:
        facade = AuthFacade(ctx.uow)
        verified = await facade.verify_password(
            account_id=ctx.account_id,
            password=data.password,
        )
    return VerifyPasswordResponse(verified=verified)


@router.post(
    "/change-password",
    response_model=ChangePasswordResponse,
)
async def change_password(
    data: ChangePasswordRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    return await change_password_handler(
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.get(
    "/devices",
    response_model=DeviceSessionListResponse,
)
async def list_devices(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate(),
        )
    ),
):
    return await list_devices_handler(
        account_id=ctx.account_id,
        current_token_hash=None,  # TODO: 현재 토큰 전달 필요 시 구현
        uow=ctx.uow,
    )


@router.post(
    "/devices/revoke",
    response_model=RevokeDeviceResponse,
)
async def revoke_device(
    data: RevokeDeviceRequest,
    *,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    return await revoke_device_handler(
        account_id=ctx.account_id,
        data=data,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.delete(
    "/me",
    status_code=204,
)
async def delete_me(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    await withdraw_handler(
        account_id=ctx.account_id,
        uow=ctx.uow,
        event_group_id=ctx.event_group_id,
    )
