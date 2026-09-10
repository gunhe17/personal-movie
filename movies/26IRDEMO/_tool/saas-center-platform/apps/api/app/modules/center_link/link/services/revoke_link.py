from app.core.type import utc_dt, uuid_str

from ..models import CenterLink
from ..repository import CenterLinkRepository

TERMINAL_STATUSES = ("rejected", "revoked")


class RevokeLinkService:
    def __init__(self, repo: CenterLinkRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        link_id: uuid_str,
        family_id: uuid_str,
        reason: str,
        now: utc_dt,
    ) -> CenterLink:
        # load
        link = await self.repo.get_in_family(id=link_id, family_id=family_id)

        # verify (터미널 재시도 = 멱등)
        if link.status in TERMINAL_STATUSES:
            return link

        # return
        updated = await self.repo.update_in_place(
            id=link_id,
            status="revoked",
            ended_at=now,
            end_reason=reason,
        )
        assert updated is not None
        return updated
