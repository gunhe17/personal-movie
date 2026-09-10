from ..models import Institution
from ..repository import InstitutionRepository


class GetInstitutionService:
    def __init__(self, repo: InstitutionRepository):
        self.repo = repo

    async def execute(self, institution_id: str) -> Institution:
        # return
        return await self.repo.get_by_id(id=institution_id)
