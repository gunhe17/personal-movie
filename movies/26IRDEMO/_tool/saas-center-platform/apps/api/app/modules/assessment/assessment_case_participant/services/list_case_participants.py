from ..repository import AssessmentCaseParticipantRepository
from ..models import AssessmentCaseParticipant


class ListCaseParticipantsService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(self, case_id: str) -> list[AssessmentCaseParticipant]:
        return await self.repo.list_by_case(case_id=case_id)
