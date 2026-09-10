from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt

from ..models import CenterLinkInvitation
from ..repository import CenterLinkInvitationRepository


class GetValidInvitationService:
    def __init__(self, repo: CenterLinkInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        code: str,
        now: utc_dt,
    ) -> CenterLinkInvitation:
        # load
        invitation = await self.repo.find_valid_by_code(code=code, now=now)

        # verify
        if invitation is None:
            raise EntityNotFoundException("유효하지 않은 초대 코드입니다")

        # return
        return invitation
