from ..models import Person
from ..repository import PersonRepository


class FindPersonByIdService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, person_id: str) -> Person | None:
        # return
        return await self.repo.find_by_id(person_id)
