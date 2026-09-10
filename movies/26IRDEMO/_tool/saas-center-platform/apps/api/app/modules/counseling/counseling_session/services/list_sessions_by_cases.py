from ..repository import CounselingSessionRepository
from ..models import CounselingSession


class ListSessionsByCasesService:
    def __init__(self, repository: CounselingSessionRepository):
        self.repository = repository

    async def execute(self, case_ids: list[str]) -> list[CounselingSession]:
        return await self.repository.list_by_case_ids(case_ids=case_ids)
