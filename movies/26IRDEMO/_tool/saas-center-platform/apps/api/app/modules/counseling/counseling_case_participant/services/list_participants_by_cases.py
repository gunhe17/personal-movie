from ..repository import CounselingCaseParticipantRepository
from ..models import CounselingCaseParticipant


class ListParticipantsByCasesService:
    def __init__(self, repository: CounselingCaseParticipantRepository):
        self.repository = repository

    async def execute(self, case_ids: list[str]) -> list[CounselingCaseParticipant]:
        return await self.repository.list_by_case_ids(case_ids=case_ids)
