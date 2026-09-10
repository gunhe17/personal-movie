"""Client Router — 내담자 관리 API"""
from fastapi import APIRouter, Depends, Query

from app.core.dependencies import ClientInfo, get_client_info
from app.modules.auth.dependencies import (
    InstitutionContext,
    get_institution_context,
)
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.client.handlers import (
    handle_create_client,
    handle_delete_client,
    handle_get_client,
    handle_list_clients,
    handle_update_client,
)
from app.modules.client.schemas import (
    ClientCreate,
    ClientListResponse,
    ClientResponse,
    ClientUpdate,
)

router = APIRouter(
    prefix="/institutions/{institution_id}/clients",
    tags=["clients"],
)


@router.get("", response_model=ClientListResponse)
async def list_clients(
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: str | None = Query(None),
    status: str | None = Query(None, pattern="^(active|inactive)$"),
    gender: str | None = Query(None, pattern="^(male|female)$"),
):
    return await handle_list_clients(
        ctx.institution_id, uow,
        page=page, size=size, search=search, status=status, gender=gender,
    )


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_get_client(ctx.institution_id, client_id, uow)


@router.post("", response_model=ClientResponse, status_code=201)
async def create_client(
    data: ClientCreate,
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_create_client(ctx, data, client_info, uow)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: str,
    data: ClientUpdate,
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_update_client(ctx, client_id, data, client_info, uow)


@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    ctx: InstitutionContext = Depends(get_institution_context),
    client_info: ClientInfo = Depends(get_client_info),
    uow: UnitOfWork = Depends(get_uow),
):
    return await handle_delete_client(ctx, client_id, client_info, uow)
