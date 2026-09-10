from ..repository import ClientRelationRepository
from ..models import ClientRelation


class ListRelationsByClientIdsService:
    def __init__(self, repo: ClientRelationRepository):
        self.repo = repo

    async def execute(
        self,
        client_ids: list[str],
        center_id: str,
    ) -> list[ClientRelation]:
        if not client_ids:
            return []

        return await self.repo.list_by_client_ids(
            center_id=center_id,
            client_ids=client_ids,
        )
