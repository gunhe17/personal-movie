"""멤버 초대 라우터"""

from fastapi import APIRouter, Depends, Query

from app.behavior import (
    behavior,
    ServerContext,
    UnscopedContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from app.core.permissions import Permission
from .schemas import (
    MemberInvitationCreate,
    MemberInvitationBulkCreate,
    MemberInvitationBulkResponse,
    MemberInvitationListResponse,
    InvitationStatus,
    MemberInvitationResponse,
)
from .handlers import (
    cancel_member_invitation_handler,
)

# Application Layer Handler (크로스 모듈 조율) - 직접 파일 import (순환 참조 방지)
from app.application.handlers.center.create_member_invitation import (
    create_member_invitation_handler,
)
from app.application.handlers.center.bulk_create_member_invitations import (
    bulk_create_member_invitations_handler,
)
from app.application.handlers.center.list_member_invitations import (
    list_member_invitations_handler,
)
from app.application.handlers.center.accept_member_invitation import (
    accept_member_invitation_handler,
)

router = APIRouter(tags=["Centers - Member Invitations"])


@router.post(
    "",
    status_code=201,
    response_model=MemberInvitationResponse,
)
async def create_member_invitation(
    center_id: str,  # Path parameter (from /centers/{center_id}/member-invitations)
    data: MemberInvitationCreate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER_INVITATION),
            dispatch_events(),
        )
    ),
):
    return await create_member_invitation_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        invited_by=ctx.account_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/batch",
    status_code=201,
    response_model=MemberInvitationBulkResponse,
)
async def bulk_create_member_invitations(
    center_id: str,  # Path parameter (from /centers/{center_id}/member-invitations)
    data: MemberInvitationBulkCreate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER_INVITATION),
            dispatch_events(),
        )
    ),
):
    return await bulk_create_member_invitations_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        data=data,
        invited_by=ctx.account_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.get(
    "",
    response_model=MemberInvitationListResponse,
)
async def list_member_invitations(
    center_id: str,  # Path parameter (from /centers/{center_id}/member-invitations)
    status: InvitationStatus | None = Query(
        None, description="상태 필터 (pending, accepted, expired)"
    ),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: str | None = Query(None, description="이름 검색"),
    role_code: str | None = Query(
        None, description="역할 코드 필터 (ADMIN/MANAGER/STAFF/COUNSELOR)"
    ),
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_MEMBER_INVITATION),
        )
    ),
):
    return await list_member_invitations_handler(
        ctx.center_id, status, page, size, ctx.uow, search, role_code
    )


@router.delete(
    "/{invitation_id}",
    status_code=204,
)
async def cancel_member_invitation(
    center_id: str,  # Path parameter (from /centers/{center_id}/member-invitations)
    invitation_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER_INVITATION),
            dispatch_events(),
        )
    ),
):
    await cancel_member_invitation_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        invitation_id=invitation_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


# 초대 수락 (로그인/회원가입 완료 후 호출)
@router.post(
    "/{invitation_id}/accept",
    response_model=MemberInvitationResponse,
)
async def accept_member_invitation(
    invitation_id: str,
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            start_event_group(),
            authenticate(),
            dispatch_events(),
        )
    ),
):
    return await accept_member_invitation_handler(
        invitation_id,
        ctx.person_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.account_id,
    )
