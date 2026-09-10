from ..models import Person
from ..repository import PersonRepository


class ListPersonsByPhoneService:
    def __init__(
        self,
        repo: PersonRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        phone: str,
    ) -> list[Person]:
        # return
        return await self.repo.list_by_phone(phone)
