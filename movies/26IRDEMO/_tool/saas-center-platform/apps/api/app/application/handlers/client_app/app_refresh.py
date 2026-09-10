from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.common.base import AUDIENCE_CLIENT_APP
from app.infrastructure.token.factory import get_token
from app.modules.auth.facade import AuthFacade
from app.modules.client_app.schemas import AppRefreshRequest, AppTokenResponse
from app.modules.person.facade import PersonFacade


async def app_refresh_handler(
    data: AppRefreshRequest,
    uow: UnitOfWork,
) -> AppTokenResponse:
    async with uow:
        account = await AuthFacade(uow).validate_refresh_token(
            refresh_token=data.refresh_token,
        )

        person = await PersonFacade(uow).find_person_by_account(account.id)

        access_token = get_token().create_access_token(
            data={
                "account_id": account.id,
                "person_id": person.id if person else None,
                "email": account.email,
            },
            account_token_version=account.token_version,
            audience=AUDIENCE_CLIENT_APP,
        )

    return AppTokenResponse(
        access_token=access_token,
        refresh_token=data.refresh_token,
    )
