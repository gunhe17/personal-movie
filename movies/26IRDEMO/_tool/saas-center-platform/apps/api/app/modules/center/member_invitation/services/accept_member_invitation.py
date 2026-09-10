from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException

from ..events import MemberInvitationAtomic
from ..models import MemberInvitation
from ..repository import MemberInvitationRepository


class AcceptMemberInvitationService:
    def __init__(self, repo: MemberInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        invitation_id: str,
        member_id: str,
    ) -> tuple[MemberInvitationAtomic, MemberInvitation]:
        # load
        invitation = await self.repo.get_by_id(invitation_id)

        # verify
        if invitation.member_id is not None:
            raise InvalidOperationException("이미 수락된 초대입니다")
        if invitation.expires_at < utc_now():
            raise InvalidOperationException("만료된 초대입니다")

        # update
        updated_invitation = await self.repo.update_completed(
            invitation_id=invitation_id,
            member_id=member_id,
        )
        if updated_invitation is None:
            raise InvalidOperationException("초대 수락 처리에 실패했습니다")

        # return
        return MemberInvitationAtomic.accepted(invitation=updated_invitation)
