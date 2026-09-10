from ..repository import ClientRelationRepository
from ..models import ClientRelation


class FindPrimaryGuardianService:
    def __init__(self, repo: ClientRelationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        child_id: str,
    ) -> ClientRelation | None:
        return await self.repo.find_primary_guardian(center_id=center_id, child_id=child_id)
