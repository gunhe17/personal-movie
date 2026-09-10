from ..events import CaseAnalysisAtomic
from ..models import CounselingCaseAnalysis
from ..repository import CounselingCaseAnalysisRepository


class MarkAnalysisFailedService:
    def __init__(self, repo: CounselingCaseAnalysisRepository):
        self.repo = repo

    async def execute(
        self,
        analysis_id: str,
        *,
        error_message: str,
    ) -> tuple[CaseAnalysisAtomic, CounselingCaseAnalysis]:
        # save
        updated = await self.repo.update_in_place(
            analysis_id,
            status="failed",
            error_message=error_message[:500],
        )

        # return
        return CaseAnalysisAtomic.failed(analysis=updated)
