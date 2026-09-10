from ..repository import ClientFavoriteRepository


class IsFavoritedService:
    def __init__(self, repo: ClientFavoriteRepository):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        client_id: str,
    ) -> bool:
        existing = await self.repo.find_by_person_client(
            person_id=person_id,
            client_id=client_id,
        )
        return existing is not None
