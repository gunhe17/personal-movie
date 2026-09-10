"""Member Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.unit_of_work import UnitOfWork
from app.modules.member.facade import MemberFacade
from app.modules.member.schemas import (
    MemberListResponse,
    MemberResponse,
    MemberUpdate,
)


async def handle_list_members(
    institution_id: str,
    uow: UnitOfWork,
    *,
    page: int = 1,
    size: int = 20,
    search: str | None = None,
    role: str | None = None,
) -> MemberListResponse:
    async with uow:
        return await MemberFacade(uow).list_members(
            institution_id,
            page=page, size=size, search=search, role=role,
        )


async def handle_get_member(
    institution_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> MemberResponse:
    async with uow:
        return await MemberFacade(uow).get_member(institution_id, member_id)


async def handle_update_member(
    ctx: InstitutionContext,
    member_id: str,
    data: MemberUpdate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> MemberResponse:
    async with uow:
        result = await MemberFacade(uow).update_member(
            ctx, member_id, data, client_info
        )
        await uow.commit()
        return result
