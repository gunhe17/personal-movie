from fastapi import Request

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.common.base import AUDIENCE_CLIENT_APP
from app.infrastructure.token.factory import get_token
from app.modules.auth.facade import AuthFacade
from app.modules.client_app.schemas import AppSignupRequest, AppTokenResponse
from app.modules.family.facade import FamilyFacade
from app.modules.person.facade import PersonFacade


async def app_signup_handler(
    data: AppSignupRequest,
    request: Request,
    uow: UnitOfWork,
) -> AppTokenResponse:
    device_info = request.headers.get("User-Agent")
    ip_address = request.client.host if request.client else None

    async with uow:
        result = await AuthFacade(uow).signup(
            email=data.email,
            password=data.password,
            device_info=device_info,
            ip_address=ip_address,
        )

        # behavior 미전환 표면 — event_group_id가 없어 atomic 미발행(전환 시 emit 추가)
        _person_atomic, person = await PersonFacade(uow).create_person(
            account_id=result.account.id,
            name=data.name,
            phone=data.phone,
            birth=None,
            gender=None,
        )

        await FamilyFacade(uow).ensure_family(person_id=person.id)

        access_token = get_token().create_access_token(
            data={
                "account_id": result.account.id,
                "person_id": person.id,
                "email": result.account.email,
            },
            audience=AUDIENCE_CLIENT_APP,
        )

    return AppTokenResponse(
        access_token=access_token,
        refresh_token=result.refresh_token,
    )
