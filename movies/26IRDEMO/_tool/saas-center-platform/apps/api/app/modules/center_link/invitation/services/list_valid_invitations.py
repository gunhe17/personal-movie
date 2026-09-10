from app.core.type import utc_dt, uuid_str

from ..models import CenterLinkInvitation
from ..repository import CenterLinkInvitationRepository


class ListValidInvitationsService:
    def __init__(self, repo: CenterLinkInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        guardian_client_id: uuid_str,
        now: utc_dt,
    ) -> list[CenterLinkInvitation]:
        # return
        return await self.repo.list_valid_for_guardian(
            center_id=center_id,
            guardian_client_id=guardian_client_id,
            now=now,
        )
