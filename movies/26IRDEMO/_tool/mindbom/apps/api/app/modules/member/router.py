"""Member Router — 직원 관리 API

직원 생성은 invitation 모듈로 이전됨 — 이 라우터는 조회/수정만 제공.
"""
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import ClientInfo, get_client_info
from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
    require_role,
)
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.member.handlers import (
    handle_get_member,
    handle_list_members,
    handle_update_member,
)
from app.modules.member.schemas import (
    MemberListResponse,
    MemberResponse,
    MemberUpdate,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/members",
    tags=["members"],
)


@router.get("", response_model=MemberListResponse)
async def list_members(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: str | None = Query(None),
    role: str | None = Query(None, pattern="^(admin|clinician|researcher)$"),
):
    return await handle_list_members(
        ctx.institution_id, uow,
        page=page, size=size, search=search, role=role,
    )


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_get_member(ctx.institution_id, member_id, uow)


@router.patch("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: str,
    data: MemberUpdate,
    ctx: InstitutionContext = Depends(require_role("admin")),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_update_member(ctx, member_id, data, client_info, uow)
