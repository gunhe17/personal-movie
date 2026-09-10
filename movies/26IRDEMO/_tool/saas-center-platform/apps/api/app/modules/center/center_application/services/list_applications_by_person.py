from ..models import CenterApplication
from ..repository import CenterApplicationRepository


class ListApplicationsByPersonService:
    def __init__(self, repo: CenterApplicationRepository):
        self.repo = repo

    async def execute(self, account_id: str) -> list[CenterApplication]:
        # return
        return await self.repo.list_by_account(account_id=account_id)
