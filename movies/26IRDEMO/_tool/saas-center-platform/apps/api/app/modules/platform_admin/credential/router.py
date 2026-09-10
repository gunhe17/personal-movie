from typing import Literal

from app.behavior import (
    behavior,
    AdminContext,
    authenticate_admin,
    require_role,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.modules.person.credential.schemas import CredentialResponse
from app.modules.platform_admin.auth.dependencies import ADMIN_PLUS

from app.application.handlers.credential import (
    approve_credential_handler,
    reject_credential_handler,
)

from .handlers import (
    list_account_credentials_handler,
    list_pending_credentials_handler,
)
from .schemas import (
    AdminCredentialListResponse,
    AdminCredentialResponse,
    CredentialRejectRequest,
)

router = APIRouter(tags=["Admin - Credentials"])


@router.get(
    "/",
    response_model=AdminCredentialListResponse,
)
async def list_pending_credentials(
    credential_type: Literal["education", "career", "certification"] | None = Query(
        default=None, description="credential_type 필터"
    ),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_pending_credentials_handler(
        ctx.uow,
        credential_type=credential_type,
        page=page,
        limit=limit,
    )


@router.post(
    "/{credential_id}/approve",
    response_model=CredentialResponse,
)
async def approve_credential(
    credential_id: str,
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
    return await approve_credential_handler(
        credential_id=credential_id,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.post(
    "/{credential_id}/reject",
    response_model=CredentialResponse,
)
async def reject_credential(
    credential_id: str,
    body: CredentialRejectRequest,
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
    return await reject_credential_handler(
        credential_id=credential_id,
        reason=body.reason,
        actor_id=ctx.admin_account_id,
        ip=ctx.ip,
        event_group_id=ctx.event_group_id,
        uow=ctx.uow,
    )


@router.get(
    "/by-account/{account_id}",
    response_model=list[AdminCredentialResponse],
    description="pending → unverified → rejected → verified 순으로 정렬됩니다.",
)
async def list_account_credentials(
    account_id: str,
    *,
    ctx: AdminContext = Depends(behavior.request_admin(authenticate_admin())),
):
    return await list_account_credentials_handler(account_id, ctx.uow)
