from ..models import MemberInvitation
from ..repository import MemberInvitationRepository


class GetMemberInvitationService:
    def __init__(self, repo: MemberInvitationRepository):
        self.repo = repo

    async def execute(self, invitation_id: str) -> MemberInvitation:
        # return
        return await self.repo.get_by_id(invitation_id)
