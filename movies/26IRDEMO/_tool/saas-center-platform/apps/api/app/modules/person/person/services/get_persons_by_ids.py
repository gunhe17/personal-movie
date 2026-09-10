from ..models import Person
from ..repository import PersonRepository


class GetPersonsByIdsService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, person_ids: list[str]) -> dict[str, Person]:
        # return
        if not person_ids:
            return {}
        persons = await self.repo.list_by_ids(person_ids)
        return {p.id: p for p in persons}
