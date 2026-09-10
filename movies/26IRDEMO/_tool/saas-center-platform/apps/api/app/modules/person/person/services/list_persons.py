from app.infrastructure.persistence.new_repository import Page

from ..models import Person
from ..repository import PersonRepository


class ListPersonsService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        page: int = 1,
        size: int = 100,
    ) -> tuple[list[Person], Page]:
        # return
        return await self.repo.list_with_page(page=page, size=size)
