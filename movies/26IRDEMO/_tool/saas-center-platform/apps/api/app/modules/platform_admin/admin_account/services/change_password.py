from app.infrastructure.hash.factory import get_password_hasher
from app.core.exceptions import InvalidOperationException, UnauthorizedException
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_account.models import AdminAccount


class ChangePasswordService:
    # 어드민 비밀번호 변경 서비스
    #
    # 현재 비밀번호 검증 후 새 비밀번호로 변경합니다.

    def __init__(self, repo: AdminAccountRepository):
        self.repo = repo

    async def execute(
        self,
        admin_account_id: str,
        current_password: str,
        new_password: str,
    ) -> AdminAccount:
        # 1. 계정 조회
        admin = await self.repo.find_by_id(admin_account_id)
        if not admin:
            raise UnauthorizedException("계정을 찾을 수 없습니다")

        # 2. 현재 비밀번호 검증
        if not get_password_hasher().verify(hash=admin.password, value=current_password):
            raise UnauthorizedException("현재 비밀번호가 올바르지 않습니다")

        # 3. 새 비밀번호가 현재와 동일한지 확인
        if get_password_hasher().verify(hash=admin.password, value=new_password):
            raise InvalidOperationException("현재 비밀번호와 동일한 비밀번호는 사용할 수 없습니다")

        # 4. 비밀번호 변경
        await self.repo.update_password(
            id=admin_account_id,
            password=get_password_hasher().hash(value=new_password),
        )

        return admin
