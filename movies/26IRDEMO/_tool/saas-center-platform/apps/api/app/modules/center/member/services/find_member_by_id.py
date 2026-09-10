from ..repository import MemberRepository
from ..models import Member


class FindMemberByIdService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, member_id: str) -> Member | None:
        # return
        return await self.repo.find_by_id(id=member_id)
