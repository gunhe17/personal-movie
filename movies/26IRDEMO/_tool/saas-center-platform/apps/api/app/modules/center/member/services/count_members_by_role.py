from ..repository import MemberRepository


class CountMembersByRoleService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(self, center_id: str, role_id: str) -> int:
        # return
        return await self.repo.count_by_role_id(
            center_id=center_id,
            role_id=role_id,
        )
