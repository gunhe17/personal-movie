from app.infrastructure.persistence.new_repository import Page

from ..repository import ClientRepository
from ..models import Client


class ListClientsService:
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        *,
        skip: int = 0,
        limit: int = 100,
        role: str | None = None,
        status: str | None = None,
        gender: str | None = None,
        search: str | None = None,
        sort: str | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Client], Page]:
        # return
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            role=role,
            status=status,
            gender=gender,
            search=search,
            sort=sort,
            ids=ids,
            skip=skip,
            limit=limit,
        )
