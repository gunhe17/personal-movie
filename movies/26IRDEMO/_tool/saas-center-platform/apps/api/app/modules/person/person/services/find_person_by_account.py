from ..models import Person
from ..repository import PersonRepository


class FindPersonByAccountService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> Person | None:
        # return
        return await self.repo.find_by_account_id(account_id=account_id)
