"""Institution Router — 기관 정보 관리"""
from fastapi import APIRouter, Depends

from app.core.dependencies import ClientInfo, get_client_info
from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
    require_role,
)
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.institution.handlers import (
    handle_get_institution,
    handle_update_institution,
)
from app.modules.institution.schemas import (
    InstitutionResponse,
    InstitutionUpdate,
)

router = APIRouter(
    prefix="/institutions/{institution_id}",
    tags=["institutions"],
)


@router.get("", response_model=InstitutionResponse)
async def get_institution(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    """기관 정보 조회 (소속 멤버 누구나)"""
    return await handle_get_institution(ctx.institution_id, uow)


@router.patch("", response_model=InstitutionResponse)
async def update_institution(
    data: InstitutionUpdate,
    ctx: InstitutionContext = Depends(require_role("admin")),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    """기관 정보 수정 (admin 전용)"""
    return await handle_update_institution(ctx, data, client_info, uow)
