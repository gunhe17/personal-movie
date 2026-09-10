from ..repository import CounselingCaseAnalysisRepository
from ..models import CounselingCaseAnalysis


class ListAnalysesService:
    def __init__(self, repo: CounselingCaseAnalysisRepository):
        self.repo = repo

    async def execute(
        self, case_id: str, center_id: str
    ) -> list[CounselingCaseAnalysis]:
        return await self.repo.list_by_case(case_id=case_id, center_id=center_id)
