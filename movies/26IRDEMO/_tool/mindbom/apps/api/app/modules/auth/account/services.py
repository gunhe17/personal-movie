"""Account Services"""
from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    AccountLockedException,
    UnauthorizedException,
)
from app.core.password_policy import validate_password
from app.core.security import verify_password, get_password_hash
from app.modules.auth.account.models import Account
from app.modules.auth.account.repository import AccountRepository

LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15


class GetAccountService:
    """계정 조회"""
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> Account | None:
        return await self.repo.get(account_id)


class AuthenticateService:
    """로그인 인증 (잠금 정책 포함)

    Returns:
        AuthResult — outcome / account / failure_reason
    """
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(
        self,
        email: str,
        password: str,
        ip_address: str | None = None,
    ) -> Account:
        account = await self.repo.get_by_email(email)
        if not account:
            raise UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.")

        # 잠금 상태 체크
        now = utc_now()
        if account.lockout_until and account.lockout_until > now:
            raise AccountLockedException(
                f"계정이 잠겼습니다. {account.lockout_until.strftime('%H:%M')} 이후에 다시 시도하세요."
            )

        if not account.is_active:
            raise UnauthorizedException("비활성화된 계정입니다.")

        # 비밀번호 검증
        if not verify_password(password, account.password_hash):
            account.failed_login_attempts += 1
            if account.failed_login_attempts >= LOCKOUT_THRESHOLD:
                account.lockout_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            await self.repo.flush()
            raise UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.")

        # 성공: 카운터 리셋, 로그인 시각/IP 갱신
        account.failed_login_attempts = 0
        account.lockout_until = None
        account.last_login_at = now
        account.last_login_ip = ip_address
        await self.repo.flush()
        return account


class CreateAccountService:
    """계정 생성 (비밀번호 정책 강제)"""
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(self, email: str, password: str, name: str) -> Account:
        existing = await self.repo.get_by_email(email)
        if existing:
            from app.core.exceptions import ConflictException
            raise ConflictException(f"이미 존재하는 이메일입니다: {email}")

        validate_password(password, email=email)

        return await self.repo.create({
            "email": email,
            "password_hash": get_password_hash(password),
            "name": name,
        })


class ChangePasswordService:
    """비밀번호 변경 (현재 비밀번호 검증 + 새 정책 적용)

    성공 시 token_version 증가로 모든 기존 토큰 무효화.
    """
    def __init__(self, repo: AccountRepository):
        self.repo = repo

    async def execute(
        self,
        account_id: str,
        current_password: str,
        new_password: str,
    ) -> Account:
        account = await self.repo.get(account_id)
        if not account:
            raise UnauthorizedException("계정을 찾을 수 없습니다.")
        if not verify_password(current_password, account.password_hash):
            raise UnauthorizedException("현재 비밀번호가 올바르지 않습니다.")

        if current_password == new_password:
            from app.core.exceptions import InvalidOperationException
            raise InvalidOperationException(
                "새 비밀번호는 기존 비밀번호와 달라야 합니다."
            )

        validate_password(new_password, email=account.email)

        account.password_hash = get_password_hash(new_password)
        account.token_version += 1  # 모든 access token 즉시 무효화
        account.failed_login_attempts = 0
        account.lockout_until = None
        await self.repo.flush()
        return account
