from fastapi import Request

from app.core.exceptions import PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.infrastructure.token.common.base import AUDIENCE_CLIENT_APP
from app.infrastructure.token.factory import get_token
from app.modules.auth.facade import AuthFacade
from app.modules.client_app.schemas import AppLoginRequest, AppTokenResponse
from app.modules.event import emit
from app.modules.person.facade import PersonFacade


async def app_login_handler(
    data: AppLoginRequest,
    request: Request,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> AppTokenResponse:
    ip_address = request.client.host if request.client else "unknown"
    device_info = request.headers.get("User-Agent")

    get_rate_limiter().check_and_record(f"ip:{ip_address}", limit=5)
    get_rate_limiter().check_and_record(f"email:{data.email}", limit=10)

    result = await AuthFacade(uow).login(
        email=data.email,
        password=data.password,
        device_info=device_info,
        ip_address=ip_address,
    )

    if result.locked_reasons:
        await uow.reject(
            PermissionDeniedException(
                f"Account locked due to suspicious activity. "
                f"Reasons: {', '.join(result.locked_reasons)}"
            )
        )

    person = await PersonFacade(uow).find_person_by_account(result.account.id)

    await emit(
        uow,
        "account_logged_in",
        event_group_id=event_group_id,
        atomics=result.atomics,
        actor_id=person.id if person else result.account.id,
    )

    access_token = get_token().create_access_token(
        data={
            "account_id": result.account.id,
            "person_id": person.id if person else None,
            "email": result.account.email,
        },
        account_token_version=result.account.token_version,
        audience=AUDIENCE_CLIENT_APP,
    )

    response = AppTokenResponse(
        access_token=access_token,
        refresh_token=result.refresh_token,
    )

    get_rate_limiter().reset(f"ip:{ip_address}")
    get_rate_limiter().reset(f"email:{data.email}")

    return response
