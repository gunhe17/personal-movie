from app.core.exceptions import ConflictException
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountManagementRepository,
)


class VerifyAdminEmailAvailableService:
    def __init__(
        self,
        repo: AdminAccountManagementRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        email: str,
    ) -> None:
        existing = await self.repo.find_by_email(email)
        if existing:
            raise ConflictException(f"이미 존재하는 어드민 계정입니다: {email}")
