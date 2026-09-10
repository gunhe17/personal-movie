from ..repository import ClientRelationRepository
from ..models import ClientRelation


class ListChildrenService:
    def __init__(self, repo: ClientRelationRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        guardian_id: str,
    ) -> list[ClientRelation]:
        return await self.repo.list_children(center_id=center_id, guardian_id=guardian_id)
