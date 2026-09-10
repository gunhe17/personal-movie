from ..events import MemberAtomic
from ..models import Member
from ..repository import MemberRepository


class LeaveCenterService:
    def __init__(
        self,
        repo: MemberRepository,
    ):
        self.repo = repo

    async def execute(self, person_id: str, center_id: str) -> tuple[MemberAtomic, Member]:
        # load
        member = await self.repo.get_by_person(
            center_id=center_id,
            person_id=person_id,
        )

        # delete
        await self.repo.remove_by_id(id=member.id)
        return MemberAtomic.left(member=member)
