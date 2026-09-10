from ..repository import ClientRepository
from ..models import Client


class ListClientsByIdsService:
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(self, client_ids: list[str]) -> list[Client]:
        if not client_ids:
            return []

        return await self.repo.list_by_ids(client_ids=client_ids)
