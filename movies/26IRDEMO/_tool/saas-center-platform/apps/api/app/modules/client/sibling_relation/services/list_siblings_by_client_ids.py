from ..repository import SiblingRelationRepository
from ..models import SiblingRelation


class ListSiblingsByClientIdsService:
    def __init__(self, repo: SiblingRelationRepository):
        self.repo = repo

    async def execute(
        self,
        client_ids: list[str],
        center_id: str,
    ) -> list[SiblingRelation]:
        if not client_ids:
            return []

        return await self.repo.list_by_client_ids(
            center_id=center_id,
            client_ids=client_ids,
        )
