from ..repository import CounselingCaseAnalysisRepository
from ..models import CounselingCaseAnalysis


class FindAnalysisService:
    def __init__(self, repo: CounselingCaseAnalysisRepository):
        self.repo = repo

    async def execute(self, analysis_id: str) -> CounselingCaseAnalysis | None:
        # return
        return await self.repo.find_by_id(analysis_id)
