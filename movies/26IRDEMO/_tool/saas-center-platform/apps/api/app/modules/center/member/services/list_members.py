from ..repository import MemberRepository
from ..models import Member


class ListMembersService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Member], int]:
        # load
        members = await self.repo.list_by_center(
            center_id=center_id,
            skip=skip,
            limit=limit,
        )
        total = await self.repo.count_by_center(center_id=center_id)

        # return
        return members, total
