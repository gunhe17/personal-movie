from app.core.exceptions import InvalidOperationException
from app.infrastructure.hash.factory import get_password_hasher
from app.modules.platform_admin.admin_account.models import AdminAccount
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountManagementRepository,
)


class CreateAccountFromInvitationService:
    def __init__(
        self,
        repo: AdminAccountManagementRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        email: str,
        name: str,
        role: str,
        password: str,
    ) -> AdminAccount:
        # verify
        existing = await self.repo.find_by_email(email)
        if existing:
            raise InvalidOperationException("이미 존재하는 어드민 계정입니다")

        # return
        return await self.repo.add(
            email=email,
            name=name,
            role=role,
            password=get_password_hasher().hash(value=password),
            is_active=True,
        )
