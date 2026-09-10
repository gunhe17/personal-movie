from fastapi import Request

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_refresh_token.repository import AdminRefreshTokenRepository
from app.modules.platform_admin.admin_account.services.verify_2fa import Verify2FAService
from app.modules.platform_admin.admin_account.services.create_admin_access_token import (
    CreateAdminAccessTokenService,
)
from app.modules.platform_admin.admin_refresh_token.services.create_admin_refresh_token import (
    CreateAdminRefreshTokenService,
)
from app.modules.platform_admin.admin_account.schemas import AdminAccountSummary
from app.modules.platform_admin.auth.schemas import AdminTokenResponse, Verify2FARequest


async def admin_verify_2fa_handler(
    data: Verify2FARequest,
    request: Request,
    uow: UnitOfWork,
    *,
    event_group_id: str,
) -> AdminTokenResponse:
    ip_address = request.client.host if request.client else "unknown"

    # Rate Limiting (브루트포스 방어)
    get_rate_limiter().check_and_record(f"admin_2fa_ip:{ip_address}", limit=10)

    # 1. pending_token 디코드 및 검증
    payload = get_token().decode_access_token(data.pending_token)
    if not payload:
        raise InvalidOperationException("유효하지 않거나 만료된 인증 토큰입니다")

    if payload.get("type") != "admin_2fa_pending":
        raise InvalidOperationException("유효하지 않은 토큰 유형입니다")

    if payload.get("token_type") != "admin":
        raise InvalidOperationException("유효하지 않은 토큰 유형입니다")

    admin_account_id = payload.get("admin_account_id")
    code_hash = payload.get("code_hash")

    if not admin_account_id or not code_hash:
        raise InvalidOperationException("토큰 정보가 올바르지 않습니다")

    # 2. Service 호출: 코드 검증 + 계정 확인 + 토큰 발급
    admin_repo = uow.repo(AdminAccountRepository)

    # 2-1. 코드 검증 + 계정 확인
    verify_service = Verify2FAService(admin_repo)
    admin = await verify_service.execute(
        admin_account_id=admin_account_id,
        submitted_code=data.code,
        code_hash=code_hash,
    )

    # 2-2. 첫 로그인 여부 확인 (갱신 전에 캡처)
    is_first_login = admin.last_login_at is None

    # 2-3. last_login_at 갱신 (2FA 완료 = 로그인 성공)
    await admin_repo.update_last_login(id=admin.id, last_login_at=utc_now())

    await emit(
        uow,
        "admin_account_logged_in",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="logged_in",
            _entity_name="admin_account",
            _entity_id=admin.id,
            _payload={},
        )],
        actor_id=admin.id,
        actor_type="admin",
        ip_address=ip_address if ip_address != "unknown" else None,
    )

    # 2-4. Access Token 생성
    access_token_service = CreateAdminAccessTokenService(admin_repo)
    access_token, _ = await access_token_service.execute(admin.id)

    # 2-5. Refresh Token 생성
    refresh_token_repo = uow.repo(AdminRefreshTokenRepository)
    refresh_token_service = CreateAdminRefreshTokenService(refresh_token_repo)
    refresh_token, _ = await refresh_token_service.execute(
        admin_account_id=admin.id,
        device_info=request.headers.get("user-agent"),
        ip_address=ip_address,
    )


    # Rate Limit 초기화 (검증 성공)
    get_rate_limiter().reset(f"admin_2fa_ip:{ip_address}")

    return AdminTokenResponse(
        admin_account=AdminAccountSummary.model_validate(admin),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        expires_in=30 * 60,
        must_change_password=is_first_login,
    )


TOOL = {
    "name": "admin_verify_2fa_handler",
    "permission": None,
    "purpose": "운영자 2단계 인증(2FA) 코드를 검증해 어드민 토큰을 발급한다.",
    "keywords": ["어드민 2FA 검증", "2단계 인증", "admin verify 2fa", "OTP 확인"],
    "boundaries": "운영자 전용 — 로그인 후 2FA 코드 검증. 로그인(코드 발송)은 admin_login_handler.",
    "output": "발급된 어드민 액세스·리프레시 토큰 (AdminTokenResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "pending_token": {'type': 'string', 'minLength': 1, 'title': '대기 토큰', 'description': 'admin_login_handler가 발급한 2FA 대기 토큰.'},
            "code": {'type': 'string', 'minLength': 1, 'maxLength': 10, 'title': '인증 코드', 'description': '이메일로 받은 2FA 인증 코드.'},
        },
        "required": ["pending_token", "code"],
    },
}
