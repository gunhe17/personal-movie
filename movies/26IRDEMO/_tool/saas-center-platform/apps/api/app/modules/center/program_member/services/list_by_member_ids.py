from ..models import ProgramMember
from ..repository import ProgramMemberRepository


class ListByMemberIdsService:
    def __init__(self, repo: ProgramMemberRepository):
        self.repo = repo

    async def execute(
        self,
        member_ids: list[str],
        center_id: str,
    ) -> list[ProgramMember]:
        # return
        return await self.repo.list_by_member_ids(
            member_ids=member_ids,
            center_id=center_id,
        )
