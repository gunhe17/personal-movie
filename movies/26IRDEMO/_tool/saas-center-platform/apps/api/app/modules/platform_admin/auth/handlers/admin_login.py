from fastapi import Request
from starlette.background import BackgroundTasks

from app.core.config import settings
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.core.logger import get_logger
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_account.services.login_admin import (
    AdminLoginService,
)
from app.modules.platform_admin.admin_account.services.generate_2fa_token import (
    Generate2FATokenService,
)
from app.infrastructure.email.factory import get_smtp_mailer
from app.infrastructure.email.templates.admin_2fa import admin_2fa_code_email
from app.infrastructure.email.common.exception import EmailSendException
from app.modules.platform_admin.admin_refresh_token.repository import (
    AdminRefreshTokenRepository,
)
from app.modules.platform_admin.admin_account.services.create_admin_access_token import (
    CreateAdminAccessTokenService,
)
from app.modules.platform_admin.admin_refresh_token.services.create_admin_refresh_token import (
    CreateAdminRefreshTokenService,
)
from app.modules.platform_admin.admin_account.schemas import AdminAccountSummary
from app.core.datetime_utils import utc_now
from app.modules.platform_admin.auth.schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminLoginUserInfo,
)

logger = get_logger(__name__)


def _send_2fa_code_email(recipient: str, name: str, code: str) -> None:
    try:
        email_service = get_smtp_mailer()
        subject, html_content, text_content = admin_2fa_code_email(
            name=name,
            code=code,
        )
        email_service.send_email(
            recipient=recipient,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )
    except EmailSendException as e:
        logger.warning(f"2FA 코드 이메일 발송 실패 (email={recipient}): {e.message}")


async def admin_login_handler(
    data: AdminLoginRequest,
    request: Request,
    uow: UnitOfWork,
    background_tasks: BackgroundTasks,
) -> AdminLoginResponse:
    ip_address = request.client.host if request.client else "unknown"

    # Rate Limiting
    get_rate_limiter().check_and_record(f"admin_ip:{ip_address}", limit=5)
    get_rate_limiter().check_and_record(f"admin_email:{data.email}", limit=10)

    async with uow:
        # 1. AdminAccount 인증 (실패 카운트 + 잠금 로직 포함)
        admin_repo = uow.repo(AdminAccountRepository)
        login_service = AdminLoginService(admin_repo)
        admin = await login_service.execute(email=data.email, password=data.password)
        # tx 예외: 인증 시도 결과(실패 카운트·잠금)를 2FA/토큰 발급과 독립 커밋(보안 흔적 보존)
        await uow.commit()

    # Rate Limit 초기화 (인증 성공)
    get_rate_limiter().reset(f"admin_ip:{ip_address}")
    get_rate_limiter().reset(f"admin_email:{data.email}")

    # 2. DEBUG 모드: 2FA 건너뛰고 바로 토큰 발급
    if settings.DEBUG:
        logger.info(f"[DEV] 2FA 스킵 — {admin.email} 바로 로그인")

        async with uow:
            admin_repo = uow.repo(AdminAccountRepository)

            is_first_login = admin.last_login_at is None
            await admin_repo.update_last_login(id=admin.id, last_login_at=utc_now())

            access_token_service = CreateAdminAccessTokenService(admin_repo)
            access_token, _ = await access_token_service.execute(admin.id)

            refresh_token_repo = uow.repo(AdminRefreshTokenRepository)
            refresh_token_service = CreateAdminRefreshTokenService(refresh_token_repo)
            ip_address = request.client.host if request.client else "unknown"
            refresh_token, _ = await refresh_token_service.execute(
                admin_account_id=admin.id,
                device_info=request.headers.get("user-agent"),
                ip_address=ip_address,
            )

            await uow.commit()

        return AdminLoginResponse(
            requires_2fa=False,
            user=AdminLoginUserInfo(
                email=admin.email,
                name=admin.name,
                role=admin.role,
            ),
            admin_account=AdminAccountSummary.model_validate(admin),
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=30 * 60,
            must_change_password=is_first_login,
        )

    # 3. 운영 모드: 2FA 코드 생성 + pending_token 발급
    token_service = Generate2FATokenService()
    code, pending_token = token_service.execute(admin)

    # 의도적 인라인(event 반응 이관 금지): OTP는 지연 민감 + 로그인이 워커 가용성에 결합되면 안 됨.
    # 유실 시 재시도는 로그인 재시도가 대신한다(at-least-once 재발송은 오히려 혼란).
    background_tasks.add_task(_send_2fa_code_email, admin.email, admin.name, code)

    return AdminLoginResponse(
        requires_2fa=True,
        pending_token=pending_token,
        user=AdminLoginUserInfo(
            email=admin.email,
            name=admin.name,
            role=admin.role,
        ),
    )


TOOL = {
    "name": "admin_login_handler",
    "permission": None,
    "purpose": "운영자 로그인으로 어드민 토큰을 발급한다.",
    "keywords": ["어드민 로그인", "관리자 로그인", "admin login"],
    "boundaries": "운영자 인증(어드민 콘솔). 토큰 갱신은 admin_refresh_handler. 일반 사용자 로그인(login_handler)과 다르다.",
    "output": "로그인 결과 — 2FA 대기 토큰 또는 어드민 토큰 (AdminLoginResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "email": {
                "format": "email",
                "title": "이메일",
                "type": "string",
                "description": "운영자 로그인 이메일.",
            },
            "password": {
                "minLength": 1,
                "title": "비밀번호",
                "type": "string",
                "description": "운영자 로그인 비밀번호.",
            },
        },
        "required": ["email", "password"],
    },
}
