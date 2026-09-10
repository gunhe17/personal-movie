from ..events import ClientFavoriteAtomic
from ..models import ClientFavorite
from ..repository import ClientFavoriteRepository


class RemoveFavoriteService:
    def __init__(
        self,
        repo: ClientFavoriteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        client_id: str,
    ) -> tuple[ClientFavoriteAtomic | None, ClientFavorite | None]:
        # load (멱등 — 미표시 해제는 no-op → atomic 없음)
        existing = await self.repo.find_by_person_client(
            person_id=person_id,
            client_id=client_id,
        )
        if existing is None:
            return None, None

        # remove
        await self.repo.hard_delete_by_person_client(
            person_id=person_id,
            client_id=client_id,
        )

        # return
        return ClientFavoriteAtomic.removed(favorite=existing)
