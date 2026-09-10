"""Client Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.unit_of_work import UnitOfWork
from app.modules.client.facade import ClientFacade
from app.modules.client.schemas import (
    ClientCreate,
    ClientListResponse,
    ClientResponse,
    ClientUpdate,
)


async def handle_list_clients(
    institution_id: str,
    uow: UnitOfWork,
    *,
    page: int = 1,
    size: int = 20,
    search: str | None = None,
    status: str | None = None,
    gender: str | None = None,
) -> ClientListResponse:
    async with uow:
        return await ClientFacade(uow).list_clients(
            institution_id, page=page, size=size,
            search=search, status=status, gender=gender,
        )


async def handle_get_client(
    institution_id: str,
    client_id: str,
    uow: UnitOfWork,
) -> ClientResponse:
    async with uow:
        return await ClientFacade(uow).get_client(client_id, institution_id)


async def handle_create_client(
    ctx: InstitutionContext,
    data: ClientCreate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> ClientResponse:
    async with uow:
        result = await ClientFacade(uow).create_client(ctx, data, client_info)
        await uow.commit()
        return result


async def handle_update_client(
    ctx: InstitutionContext,
    client_id: str,
    data: ClientUpdate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> ClientResponse:
    async with uow:
        result = await ClientFacade(uow).update_client(
            ctx, client_id, data, client_info
        )
        await uow.commit()
        return result


async def handle_delete_client(
    ctx: InstitutionContext,
    client_id: str,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> dict:
    async with uow:
        await ClientFacade(uow).delete_client(ctx, client_id, client_info)
        await uow.commit()
        return {"message": "내담자가 삭제되었습니다."}
