from ..models import ClientFavorite
from ..repository import ClientFavoriteRepository


class ListFavoritesService:
    def __init__(self, repo: ClientFavoriteRepository):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        center_id: str,
    ) -> list[ClientFavorite]:
        return await self.repo.list_by_person_in_center(
            person_id=person_id,
            center_id=center_id,
        )
