from ..models import Family
from ..repository import FamilyRepository


class CreateFamilyService:
    def __init__(self, repo: FamilyRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str | None = None,
    ) -> Family:
        # return
        return await self.repo.add(name=name)
