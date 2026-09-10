from ..repository import ClientRelationRepository
from ..models import ClientRelation


class ListGuardiansService:
    def __init__(self, repo: ClientRelationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        child_id: str,
    ) -> list[ClientRelation]:
        return await self.repo.list_guardians(center_id=center_id, child_id=child_id)
