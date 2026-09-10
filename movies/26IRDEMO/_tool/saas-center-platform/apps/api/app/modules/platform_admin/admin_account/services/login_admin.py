from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.infrastructure.hash.factory import get_password_hasher
from app.core.exceptions import UnauthorizedException, PermissionDeniedException
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_account.models import AdminAccount

# 잠금 정책
MAX_FAILED_ATTEMPTS_LOCK = 5      # 5회 실패 → 30분 잠금
MAX_FAILED_ATTEMPTS_DISABLE = 10  # 10회 실패 → 계정 비활성화
LOCK_DURATION_MINUTES = 30


class AdminLoginService:
    # 어드민 전용 로그인 서비스
    #
    # admin_accounts 테이블만 조회하며 실패 카운트/잠금 정책을 포함합니다.

    def __init__(self, repo: AdminAccountRepository):
        self.repo = repo

    async def execute(self, email: str, password: str) -> AdminAccount:
        # 1. 계정 조회
        admin = await self.repo.find_by_email(email)
        if not admin:
            raise UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다")

        # 2. 활성 상태 확인
        if not admin.is_active:
            raise PermissionDeniedException(
                "비활성화된 계정입니다. 관리자에게 문의하세요"
            )

        # 3. 잠금 상태 확인
        if admin.locked_until:
            now = utc_now()
            if now < admin.locked_until:
                remaining = int((admin.locked_until - now).total_seconds() / 60) + 1
                raise PermissionDeniedException(
                    f"계정이 잠금 상태입니다. {remaining}분 후 다시 시도하세요"
                )
            # 잠금 해제 시간 지남 → 잠금 해제
            await self.repo.update_security_state(
                id=admin.id,
                is_active=admin.is_active,
                failed_login_count=0,
                locked_until=None,
            )

        # 4. 비밀번호 검증
        if not get_password_hasher().verify(hash=admin.password, value=password):
            await self._handle_failed_login(admin)
            raise UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다")

        # 5. 로그인 성공 → 실패 카운트 리셋 (last_login_at은 2FA 완료 후 갱신)
        await self.repo.update_security_state(
            id=admin.id,
            is_active=admin.is_active,
            failed_login_count=0,
            locked_until=None,
        )

        return admin

    async def _handle_failed_login(self, admin: AdminAccount) -> None:
        failed_login_count = admin.failed_login_count + 1
        is_active = admin.is_active
        locked_until = admin.locked_until

        if failed_login_count >= MAX_FAILED_ATTEMPTS_DISABLE:
            # 10회 이상 → 계정 비활성화
            is_active = False
            locked_until = None
        elif failed_login_count >= MAX_FAILED_ATTEMPTS_LOCK:
            # 5회 이상 → 30분 잠금
            locked_until = utc_now() + timedelta(minutes=LOCK_DURATION_MINUTES)

        await self.repo.update_security_state(
            id=admin.id,
            is_active=is_active,
            failed_login_count=failed_login_count,
            locked_until=locked_until,
        )
