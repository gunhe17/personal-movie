"""Institution Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.unit_of_work import UnitOfWork
from app.modules.institution.facade import InstitutionFacade
from app.modules.institution.schemas import (
    InstitutionResponse,
    InstitutionUpdate,
)


async def handle_get_institution(
    institution_id: str,
    uow: UnitOfWork,
) -> InstitutionResponse:
    async with uow:
        return await InstitutionFacade(uow).get_institution(institution_id)


async def handle_update_institution(
    ctx: InstitutionContext,
    data: InstitutionUpdate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> InstitutionResponse:
    async with uow:
        result = await InstitutionFacade(uow).update_institution(
            ctx, data, client_info
        )
        await uow.commit()
        return result
