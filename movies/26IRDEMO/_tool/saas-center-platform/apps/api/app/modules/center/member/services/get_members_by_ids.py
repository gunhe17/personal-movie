from ..repository import MemberRepository
from ..models import Member


class GetMembersByIdsService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, member_ids: list[str]) -> dict[str, Member]:
        # guard
        if not member_ids:
            return {}

        # load
        members = await self.repo.list_by_ids(member_ids=member_ids)

        # return
        return {member.id: member for member in members}
