from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class GetCaseParticipantsByCaseIdsService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(self, case_ids: list[str]) -> list[AssessmentCaseParticipant]:
        if not case_ids:
            return []

        return await self.repo.list_by_case_ids(case_ids=case_ids)
