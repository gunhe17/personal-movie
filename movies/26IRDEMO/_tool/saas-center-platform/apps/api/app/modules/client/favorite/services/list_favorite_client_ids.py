from ..repository import ClientFavoriteRepository


class ListFavoriteClientIdsService:
    def __init__(self, repo: ClientFavoriteRepository):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        center_id: str,
    ) -> set[str]:
        return await self.repo.list_client_ids(
            person_id=person_id,
            center_id=center_id,
        )
