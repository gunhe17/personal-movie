from ..events import PersonAtomic
from ..models import Person
from ..repository import PersonRepository


class DeletePersonService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, person_id: str) -> tuple[PersonAtomic, Person]:
        # verify
        person = await self.repo.get_by_id(person_id)

        # remove
        await self.repo.remove_by_id(person_id)

        # return
        return PersonAtomic.deleted(person=person)
