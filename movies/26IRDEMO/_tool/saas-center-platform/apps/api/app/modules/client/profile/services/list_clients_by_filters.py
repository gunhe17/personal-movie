from ..repository import ClientRepository
from ..models import Client


class ListClientsByFiltersService:
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        name: str | None = None,
        phone: str | None = None,
        birth_date = None,
        role: str | None = None,
        memo: str | None = None,
        status: str | None = None,
        gender: str | None = None,
        code: str | None = None,
        email: str | None = None,
        address: str | None = None,
    ) -> list[Client]:
        # return
        return await self.repo.list_in_center(
            center_id=center_id,
            name=name,
            phone=phone,
            birth_date=birth_date,
            role=role,
            memo=memo,
            status=status,
            gender=gender,
            code=code,
            email=email,
            address=address,
        )
