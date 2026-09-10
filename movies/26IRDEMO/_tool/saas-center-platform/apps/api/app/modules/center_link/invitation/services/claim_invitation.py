from app.core.type import utc_dt, uuid_str

from ..models import CenterLinkInvitation
from ..repository import CenterLinkInvitationRepository


class ClaimInvitationService:
    def __init__(self, repo: CenterLinkInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        invitation_id: uuid_str,
        person_id: uuid_str,
        now: utc_dt,
    ) -> CenterLinkInvitation | None:
        # return
        return await self.repo.update_in_place(
            id=invitation_id,
            claimed_at=now,
            claimed_by_person_id=person_id,
        )
