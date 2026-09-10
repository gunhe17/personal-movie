from ..models import Person
from ..repository import PersonRepository


class GetPersonService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, person_id: str) -> Person:
        # return
        return await self.repo.get_by_id(person_id)
