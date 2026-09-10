from fastapi import APIRouter, Depends, Query
from app.behavior import (
    behavior,
    UnscopedContext,
    authenticate,
    start_event_group,
    dispatch_events,
)
from .institution.handlers.create_institution import create_institution_handler
from .institution.handlers.delete_institution import delete_institution_handler
from .institution.handlers.get_institution import get_institution_handler
from .institution.handlers.list_institutions import list_institutions_handler
from .institution.handlers.update_institution import update_institution_handler
from .institution.schemas import (
    InstitutionCreate,
    InstitutionUpdate,
    InstitutionResponse,
    InstitutionListResponse,
)

# 전역 참조 테이블 — center_id 스코프는 없으나 인증은 필수(익명 CRUD 차단)
router = APIRouter(tags=["institutions"])


def _account():
    return behavior.request_unscoped(authenticate())


def _account_with_events():
    return behavior.request_unscoped(
        start_event_group(),
        authenticate(),
        dispatch_events(),
    )


@router.get("/institutions/", response_model=InstitutionListResponse)
async def list_institutions(
    keyword: str | None = Query(default=None, description="이름 검색 키워드"),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    ctx: UnscopedContext = Depends(_account()),
):
    return await list_institutions_handler(keyword, page, size, ctx.uow)


@router.post("/institutions/", status_code=201, response_model=InstitutionResponse)
async def create_institution(
    data: InstitutionCreate,
    ctx: UnscopedContext = Depends(_account_with_events()),
):
    return await create_institution_handler(
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.get("/institutions/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: str,
    ctx: UnscopedContext = Depends(_account()),
):
    return await get_institution_handler(institution_id, ctx.uow)


@router.patch("/institutions/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: str,
    data: InstitutionUpdate,
    ctx: UnscopedContext = Depends(_account_with_events()),
):
    return await update_institution_handler(
        institution_id,
        data,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )


@router.delete("/institutions/{institution_id}", status_code=204)
async def delete_institution(
    institution_id: str,
    ctx: UnscopedContext = Depends(_account_with_events()),
):
    return await delete_institution_handler(
        institution_id,
        ctx.uow,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.person_id,
    )
