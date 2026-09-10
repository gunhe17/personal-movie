from ..events import MemberAtomic
from ..models import Member
from ..repository import MemberRepository


class DeleteMemberService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, member_id: str, center_id: str) -> tuple[MemberAtomic, Member]:
        # load
        member = await self.repo.get_in_center(member_id=member_id, center_id=center_id)

        # delete
        await self.repo.remove_by_id(id=member_id)
        return MemberAtomic.deleted(member=member)
