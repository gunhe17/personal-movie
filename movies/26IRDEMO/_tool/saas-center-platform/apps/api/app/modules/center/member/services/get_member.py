from ..repository import MemberRepository
from ..models import Member


class GetMemberService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, member_id: str, center_id: str) -> Member:
        # load
        member = await self.repo.get_in_center(member_id=member_id, center_id=center_id)

        # return
        return member
