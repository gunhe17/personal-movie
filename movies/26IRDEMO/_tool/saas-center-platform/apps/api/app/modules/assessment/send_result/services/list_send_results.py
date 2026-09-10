from ..repository import AssessmentSendResultRepository
from ..models import AssessmentSendResult


class ListSendResultsService:
    def __init__(self, repo: AssessmentSendResultRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
    ) -> list[AssessmentSendResult]:
        # return
        return await self.repo.list_by_case(center_id=center_id, case_id=case_id)
