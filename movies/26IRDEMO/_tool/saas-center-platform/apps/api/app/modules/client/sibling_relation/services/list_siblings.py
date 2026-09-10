from ..repository import SiblingRelationRepository
from ..models import SiblingRelation


class ListSiblingsService:
    def __init__(self, repo: SiblingRelationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
    ) -> list[SiblingRelation]:
        return await self.repo.list_siblings(center_id=center_id, client_id=client_id)
