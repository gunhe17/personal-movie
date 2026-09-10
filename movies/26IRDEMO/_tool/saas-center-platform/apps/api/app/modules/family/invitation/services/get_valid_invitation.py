from app.core.exceptions import EntityNotFoundException
from app.core.type import utc_dt

from ..models import FamilyInvitation
from ..repository import FamilyInvitationRepository


class GetValidFamilyInvitationService:
    def __init__(self, repo: FamilyInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        code: str,
        now: utc_dt,
    ) -> FamilyInvitation:
        # load
        invitation = await self.repo.find_valid_by_code(code=code, now=now)

        # verify
        if invitation is None:
            raise EntityNotFoundException("유효하지 않은 초대 코드입니다")

        # return
        return invitation
