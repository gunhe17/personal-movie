from fastapi import APIRouter, Depends

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
from app.application.handlers.member import get_my_member_handler
from app.application.handlers.member.update_my_member import (
    update_my_member_handler,
    MemberSelfUpdate,
)
from app.modules.center.member.schemas import MeMemberResponse, MemberDetailResponse
from .schemas import MyPermissionsResponse

router = APIRouter(prefix="/centers/{center_id}/me", tags=["Centers - Me"])


# behavior가 해석한 auth scope를 그대로 반환 — behavior 경계(비즈니스 아님)라 핸들러 없이 echo
@router.get(
    "/permissions",
    response_model=MyPermissionsResponse,
)
async def get_my_permissions(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return MyPermissionsResponse(
        center_id=ctx.center_id,
        member_id=ctx.actor_id,
        role_code=ctx.role_code,
        permissions=list(ctx.permissions),
        permissions_version=ctx.permissions_version,
        access_level=ctx.access_level,
    )


@router.get(
    "/member",
    response_model=MeMemberResponse,
)
async def get_my_member(
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
        )
    ),
):
    return await get_my_member_handler(ctx.center_id, ctx.actor_id, ctx.uow)


@router.patch(
    "/member",
    response_model=MemberDetailResponse,
)
async def update_my_member(
    data: MemberSelfUpdate,
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
    return await update_my_member_handler(
        ctx.center_id,
        ctx.actor_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
    )
