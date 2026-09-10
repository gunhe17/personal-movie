from ..models import Person
from ..repository import PersonRepository


class ListPersonsByNameService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, name: str) -> list[Person]:
        # return
        return await self.repo.list_by_name(name)
