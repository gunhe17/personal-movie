from ..models import PersonProfile
from ..repository import PersonProfileRepository


class FindPersonProfileService:
    def __init__(self, repo: PersonProfileRepository) -> None:
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        member_id: str,
    ) -> PersonProfile | None:
        return await self.repo.find_by_member(center_id=center_id, member_id=member_id)
