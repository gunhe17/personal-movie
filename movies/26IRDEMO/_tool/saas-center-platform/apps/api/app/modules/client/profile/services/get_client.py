from ..repository import ClientRepository
from ..models import Client


class GetClientService:
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(self, center_id: str, client_id: str) -> Client:
        # load
        client = await self.repo.get_in_center(center_id=center_id, client_id=client_id)

        # return
        return client
