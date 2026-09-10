from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_account.models import AdminAccount
from app.modules.platform_admin.auth.utils import hash_2fa_code


class Verify2FAService:
    # 2FA 인증코드 검증 + 계정 유효성 확인 서비스
    #
    # 사용자 입력 코드를 해싱하여 pending_token의 code_hash와 비교합니다.

    def __init__(self, repo: AdminAccountRepository):
        self.repo = repo

    async def execute(
        self,
        admin_account_id: str,
        submitted_code: str,
        code_hash: str,
    ) -> AdminAccount:
        # 1. 코드 검증
        if hash_2fa_code(submitted_code) != code_hash:
            raise InvalidOperationException("인증 코드가 올바르지 않습니다")

        # 2. 계정 조회
        admin = await self.repo.find_by_id(admin_account_id)
        if not admin:
            raise InvalidOperationException("계정을 찾을 수 없습니다")

        # 3. 활성 상태 확인
        if not admin.is_active:
            raise InvalidOperationException("비활성화된 계정입니다")

        return admin
