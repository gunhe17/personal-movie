from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from fastapi import APIRouter, Depends, Query

from app.core.permissions import Permission
from .schemas import (
    MemberCredentialsResponse,
    MemberDetailResponse,
    MemberMetricsResponse,
    MemberResponse,
)

# Application Layer Handler (크로스 모듈 조율) - 직접 파일 import (순환 참조 방지)
from app.application.handlers.center.get_member_credentials import (
    get_member_credentials_handler,
)
from app.application.handlers.center.delete_member import delete_member_handler
from app.application.handlers.center.leave_center import leave_center_handler
from app.application.handlers.center.activate_member import activate_member_handler
from app.application.handlers.center.deactivate_member import (
    deactivate_member_handler,
)

# Application Layer Handler (크로스 모듈 조합) - 직접 파일 import (순환 참조 방지)
from app.application.handlers.member.get_member_detail import (
    get_member_detail_handler as get_member_with_person_handler,
)
from app.application.handlers.member.list_members_enriched import (
    list_members_enriched_handler as list_members_with_person_handler,
    MemberListResponse,
)
from app.application.handlers.member.update_member_with_person import (
    update_member_with_person_handler,
    MemberWithPersonUpdate,
)
from app.application.handlers.member.get_member_metrics import (
    get_member_metrics_handler,
)

from ..member_invitation.router import router as member_invitation_router

router = APIRouter(prefix="/centers/{center_id}/members", tags=["Centers - Members"])

# /members/invitations/* → 정적 세그먼트이므로 /{member_id}보다 우선 매칭됨
router.include_router(member_invitation_router, prefix="/invitations")


# 소속 센터 탈퇴 (본인 요청) - /{member_id}보다 우선 매칭
@router.delete(
    "/me/leave",
    status_code=204,
)
async def leave_center(
    center_id: str,  # Path parameter
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            dispatch_events(),
        )
    ),
):
    await leave_center_handler(
        ctx.center_id,
        ctx.person_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


# 멤버 목록 조회
@router.get(
    "/",
    response_model=MemberListResponse,
)
async def list_members(
    center_id: str,  # Path parameter (from /centers/{center_id}/members)
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    search: str | None = Query(None, description="이름 검색"),
    role_code: str | None = Query(
        None, description="역할 코드 필터 (ADMIN/MANAGER/STAFF/COUNSELOR)"
    ),
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_MEMBER),
        )
    ),
):
    return await list_members_with_person_handler(
        ctx.center_id, page, size, ctx.uow, search, role_code
    )


# 멤버 단일 조회
@router.get(
    "/{member_id}",
    response_model=MemberDetailResponse,
)
async def get_member(
    center_id: str,  # Path parameter
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_MEMBER),
        )
    ),
):
    return await get_member_with_person_handler(ctx.center_id, member_id, ctx.uow)


# 멤버 자격 정보 조회 (학력/경력/자격 - 본인이면 전체, 아니면 verified만)
@router.get(
    "/{member_id}/credentials",
    response_model=MemberCredentialsResponse,
    description=(
        "본인이면 모든 status 항목 + legacy를 포함하고, "
        "타인이면 verified 항목만 반환합니다(legacy 제외)."
    ),
)
async def get_member_credentials(
    center_id: str,
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_MEMBER),
        )
    ),
):
    return await get_member_credentials_handler(
        ctx.center_id, member_id, ctx.person_id, ctx.uow
    )


# 멤버 활동 지표 조회 (담당 내담자 수 + 이번 달 상담 건수)
@router.get(
    "/{member_id}/metrics",
    response_model=MemberMetricsResponse,
)
async def get_member_metrics(
    center_id: str,
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_MEMBER),
        )
    ),
):
    return await get_member_metrics_handler(ctx.center_id, member_id, ctx.uow)


# 멤버 수정 (Member + Person 통합) - 관리자 전용
@router.patch(
    "/{member_id}",
    response_model=MemberDetailResponse,
)
async def update_member(
    center_id: str,  # Path parameter
    member_id: str,
    data: MemberWithPersonUpdate,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER),
            dispatch_events(),
        )
    ),
):
    return await update_member_with_person_handler(
        ctx.center_id,
        member_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )


# 멤버 삭제 (Soft Delete)
@router.delete(
    "/{member_id}",
    status_code=204,
)
async def delete_member(
    center_id: str,  # Path parameter
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.DELETE_MEMBER),
            dispatch_events(),
        )
    ),
):
    await delete_member_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=member_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


# 멤버 활성/비활성 (상태전이) - 관리자 전용
@router.post(
    "/{member_id}/activate",
    response_model=MemberResponse,
)
async def activate_member(
    center_id: str,  # Path parameter
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER),
            dispatch_events(),
        )
    ),
):
    return await activate_member_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=member_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )


@router.post(
    "/{member_id}/deactivate",
    response_model=MemberResponse,
)
async def deactivate_member(
    center_id: str,  # Path parameter
    member_id: str,
    *,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_MEMBER),
            dispatch_events(),
        )
    ),
):
    return await deactivate_member_handler(
        event_group_id=ctx.event_group_id,
        center_id=ctx.center_id,
        member_id=member_id,
        uow=ctx.uow,
        actor_id=ctx.actor_id,
    )
