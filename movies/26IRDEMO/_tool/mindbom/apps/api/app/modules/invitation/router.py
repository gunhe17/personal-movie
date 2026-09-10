"""Invitation Router — 직원 초대 API

엔드포인트 분리:
- 관리자 작업: /institutions/{id}/invitations  (admin role 필요)
- 공개 작업 (수락 페이지용): /invitations/verify, /invitations/accept
"""
from fastapi import APIRouter, Depends, Query, Response, status

from app.core.dependencies import ClientInfo, get_client_info
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.auth.dependencies import (
    InstitutionContext,
    require_role,
)
from app.modules.invitation.handlers import (
    handle_accept_invitation,
    handle_create_invitation,
    handle_list_pending_invitations,
    handle_resend_invitation,
    handle_revoke_invitation,
    handle_verify_invitation,
)
from app.modules.invitation.schemas import (
    InvitationAcceptRequest,
    InvitationAcceptResponse,
    InvitationCreate,
    InvitationListResponse,
    InvitationSummary,
    InvitationVerifyResponse,
)

# 관리자 전용 라우터
admin_router = APIRouter(
    prefix="/institutions/{institution_id}/invitations",
    tags=["invitations"],
)


@admin_router.get("", response_model=InvitationListResponse)
async def list_pending(
    ctx: InstitutionContext = Depends(require_role("admin")),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_list_pending_invitations(ctx.institution_id, uow)


@admin_router.post(
    "", response_model=InvitationSummary, status_code=status.HTTP_201_CREATED
)
async def create_invitation(
    body: InvitationCreate,
    ctx: InstitutionContext = Depends(require_role("admin")),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_create_invitation(ctx, body, client_info, uow)


@admin_router.delete("/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: str,
    ctx: InstitutionContext = Depends(require_role("admin")),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    await handle_revoke_invitation(ctx, invitation_id, client_info, uow)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.post(
    "/{invitation_id}/resend",
    response_model=InvitationSummary,
)
async def resend_invitation(
    invitation_id: str,
    ctx: InstitutionContext = Depends(require_role("admin")),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_resend_invitation(ctx, invitation_id, client_info, uow)


# 공개 라우터 (인증 불필요 — 토큰으로 검증)
public_router = APIRouter(prefix="/invitations", tags=["invitations"])


@public_router.get("/verify", response_model=InvitationVerifyResponse)
async def verify_invitation(
    token: str = Query(..., min_length=1),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_verify_invitation(token, uow)


@public_router.post("/accept", response_model=InvitationAcceptResponse)
async def accept_invitation(
    body: InvitationAcceptRequest,
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_accept_invitation(
        body.token, body.password, client_info, uow,
    )
