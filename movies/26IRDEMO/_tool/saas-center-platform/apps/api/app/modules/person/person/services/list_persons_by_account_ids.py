from ..models import Person
from ..repository import PersonRepository


class ListPersonsByAccountIdsService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, account_ids: list[str]) -> list[Person]:
        if not account_ids:
            return []
        return await self.repo.list_by_account_ids(account_ids=account_ids)
