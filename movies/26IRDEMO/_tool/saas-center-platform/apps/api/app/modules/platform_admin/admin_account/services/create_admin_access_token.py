from app.infrastructure.token.factory import get_token
from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_account.models import AdminAccount

ACCESS_TOKEN_EXPIRE_SECONDS = 30 * 60  # 30분


class CreateAdminAccessTokenService:
    def __init__(self, repo: AdminAccountRepository):
        self.repo = repo

    async def execute(self, admin_account_id: str) -> tuple[str, AdminAccount]:
        # 1. 계정 조회
        admin = await self.repo.find_by_id(admin_account_id)
        if not admin:
            raise InvalidOperationException("계정을 찾을 수 없습니다")

        # 2. 활성 상태 확인
        if not admin.is_active:
            raise InvalidOperationException("비활성화된 계정입니다")

        # 3. Access Token 생성
        access_token = get_token().create_access_token(
            data={
                "admin_account_id": admin.id,
                "email": admin.email,
                "name": admin.name,
                "role": admin.role,
                "token_type": "admin",
            },
            account_token_version=admin.token_version,
        )

        return access_token, admin
