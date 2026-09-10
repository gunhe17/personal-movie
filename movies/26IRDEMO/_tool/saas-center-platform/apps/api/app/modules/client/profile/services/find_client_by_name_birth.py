from datetime import date

from ..models import Client
from ..repository import ClientRepository


class FindClientByNameBirthService:
    def __init__(
        self,
        repo: ClientRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        name: str,
        birth_date: date | None,
    ) -> Client | None:
        # return
        return await self.repo.find_by_name_birth_in_center(
            center_id=center_id,
            name=name,
            birth_date=birth_date,
        )
