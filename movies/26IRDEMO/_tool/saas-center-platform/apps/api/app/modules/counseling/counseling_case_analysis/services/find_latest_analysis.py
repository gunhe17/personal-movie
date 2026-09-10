from ..repository import CounselingCaseAnalysisRepository
from ..models import CounselingCaseAnalysis


class FindLatestAnalysisService:
    def __init__(self, repo: CounselingCaseAnalysisRepository):
        self.repo = repo

    async def execute(
        self, case_id: str, center_id: str, completed_only: bool = False
    ) -> CounselingCaseAnalysis | None:
        return await self.repo.find_latest_by_case(
            case_id=case_id, center_id=center_id, completed_only=completed_only
        )
