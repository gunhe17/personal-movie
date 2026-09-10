from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.modules.platform_admin.admin_account_management.models import AdminAccountInvitation
from app.modules.platform_admin.admin_account_management.repository import (
    AdminAccountInvitationRepository,
)


class GetValidInvitationService:
    def __init__(
        self,
        repo: AdminAccountInvitationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        invitation_id: str,
    ) -> AdminAccountInvitation:
        invitation = await self.repo.find_by_id(invitation_id)
        if not invitation or invitation.deleted_at is not None:
            raise InvalidOperationException("초대 정보를 찾을 수 없습니다")

        if invitation.accepted_at is not None:
            raise InvalidOperationException("이미 수락된 초대입니다")

        if invitation.expires_at < utc_now():
            raise InvalidOperationException("만료된 초대 링크입니다")

        return invitation
