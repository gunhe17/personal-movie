from ..models import Client
from ..repository import ClientRepository


class GetClientByIdService:
    def __init__(
        self,
        repo: ClientRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        client_id: str,
    ) -> Client:
        # return (center 미상 조회 — 소유 center 해석용)
        return await self.repo.get_by_id(client_id)
