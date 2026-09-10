from ..repository import MemberRepository


class CountMembersByRolesService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, center_id: str) -> dict[str, int]:
        # return
        return await self.repo.aggregate_by_roles(center_id=center_id)
