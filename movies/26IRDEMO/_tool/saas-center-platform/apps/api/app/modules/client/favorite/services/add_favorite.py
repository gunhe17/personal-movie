from ..events import ClientFavoriteAtomic
from ..models import ClientFavorite
from ..repository import ClientFavoriteRepository


class AddFavoriteService:
    def __init__(
        self,
        repo: ClientFavoriteRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        person_id: str,
        client_id: str,
        center_id: str,
    ) -> tuple[ClientFavoriteAtomic | None, ClientFavorite]:
        # load (멱등 — 기존 표시는 새 사실 아님 → atomic 없음)
        existing = await self.repo.find_by_person_client(
            person_id=person_id,
            client_id=client_id,
        )
        if existing:
            return None, existing

        # mutate
        favorite = await self.repo.add(
            person_id=person_id,
            client_id=client_id,
            center_id=center_id,
        )

        # return
        return ClientFavoriteAtomic.added(favorite=favorite)
