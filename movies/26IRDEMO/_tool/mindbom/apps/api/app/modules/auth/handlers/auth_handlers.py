"""Auth Handlers — 트랜잭션 관리 + Facade 호출"""
from app.core.unit_of_work import UnitOfWork
from app.modules.auth.facade.auth_facade import AuthFacade
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    ResetPasswordRequest,
    SignupRequest,
    VerifyPasswordRequest,
)


async def handle_login(
    body: LoginRequest,
    uow: UnitOfWork,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> LoginResponse:
    async with uow:
        facade = AuthFacade(uow)
        result = await facade.login(body.email, body.password, user_agent, ip_address)
        await uow.commit()
        return result


async def handle_signup(
    body: SignupRequest,
    uow: UnitOfWork,
) -> LoginResponse:
    async with uow:
        facade = AuthFacade(uow)
        result = await facade.signup(body.email, body.password, body.name, body.institution_name)
        await uow.commit()
        return result


async def handle_refresh(
    body: RefreshRequest,
    uow: UnitOfWork,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> RefreshResponse:
    async with uow:
        facade = AuthFacade(uow)
        result = await facade.refresh(body.refresh_token, user_agent, ip_address)
        await uow.commit()
        return result


async def handle_me(
    account_id: str,
    uow: UnitOfWork,
    *,
    current_institution_id: str | None = None,
) -> MeResponse:
    async with uow:
        facade = AuthFacade(uow)
        return await facade.get_me(
            account_id, current_institution_id=current_institution_id,
        )


async def handle_logout(
    body: RefreshRequest,
    uow: UnitOfWork,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> MessageResponse:
    async with uow:
        facade = AuthFacade(uow)
        await facade.logout(
            body.refresh_token,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        await uow.commit()
        return MessageResponse(message="로그아웃 되었습니다.")


async def handle_change_password(
    account_id: str,
    body: ChangePasswordRequest,
    uow: UnitOfWork,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> MessageResponse:
    async with uow:
        facade = AuthFacade(uow)
        await facade.change_password(
            account_id, body.current_password, body.new_password,
            user_agent=user_agent, ip_address=ip_address,
        )
        await uow.commit()
        return MessageResponse(message="비밀번호가 변경되었습니다. 다시 로그인해주세요.")


# enumeration 방지를 위해 성공/실패 모두 동일한 메시지
_FORGOT_PASSWORD_MESSAGE = (
    "입력하신 이메일이 등록되어 있다면 재설정 링크를 발송했습니다. 메일함을 확인해주세요."
)


async def handle_forgot_password(
    body: ForgotPasswordRequest,
    uow: UnitOfWork,
) -> MessageResponse:
    async with uow:
        facade = AuthFacade(uow)
        await facade.request_password_reset(body.email)
        await uow.commit()
        return MessageResponse(message=_FORGOT_PASSWORD_MESSAGE)


async def handle_reset_password(
    body: ResetPasswordRequest,
    uow: UnitOfWork,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> MessageResponse:
    async with uow:
        facade = AuthFacade(uow)
        await facade.confirm_password_reset(
            body.token, body.new_password,
            user_agent=user_agent, ip_address=ip_address,
        )
        await uow.commit()
        return MessageResponse(message="비밀번호가 변경되었습니다. 다시 로그인해주세요.")


async def handle_verify_password(
    account_id: str,
    body: VerifyPasswordRequest,
    uow: UnitOfWork,
) -> MessageResponse:
    async with uow:
        facade = AuthFacade(uow)
        await facade.verify_password(account_id, body.password)
        return MessageResponse(message="확인되었습니다.")
