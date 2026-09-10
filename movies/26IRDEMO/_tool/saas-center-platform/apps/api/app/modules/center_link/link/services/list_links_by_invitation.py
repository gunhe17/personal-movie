from app.core.type import uuid_str

from ..models import CenterLink
from ..repository import CenterLinkRepository


class ListLinksByInvitationService:
    def __init__(
        self,
        repo: CenterLinkRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        invitation_id: uuid_str,
    ) -> list[CenterLink]:
        # return
        return await self.repo.list_by_invitation(invitation_id=invitation_id)
