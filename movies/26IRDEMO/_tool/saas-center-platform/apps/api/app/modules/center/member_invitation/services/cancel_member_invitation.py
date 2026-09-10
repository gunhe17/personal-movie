from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException

from ..events import MemberInvitationAtomic
from ..models import MemberInvitation
from ..repository import MemberInvitationRepository


class CancelMemberInvitationService:
    def __init__(self, repo: MemberInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        invitation_id: str,
    ) -> tuple[MemberInvitationAtomic, MemberInvitation]:
        # load
        invitation = await self.repo.get_in_center(
            invitation_id=invitation_id,
            center_id=center_id,
        )

        # verify
        if invitation.accepted_at is not None:
            raise InvalidOperationException("이미 수락된 초대는 취소할 수 없습니다")
        if invitation.expires_at <= utc_now():
            raise InvalidOperationException("이미 만료된 초대입니다")

        # delete
        await self.repo.remove_by_id(id=invitation_id)
        return MemberInvitationAtomic.cancelled(invitation=invitation)
