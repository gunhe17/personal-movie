from ..events import CaseAnalysisAtomic
from ..models import CounselingCaseAnalysis
from ..repository import CounselingCaseAnalysisRepository


class StartAnalysisService:
    def __init__(self, repo: CounselingCaseAnalysisRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        case_id: str,
        triggered_by: str,
        member_id: str | None,
        session_take: int | None = None,
    ) -> tuple[CaseAnalysisAtomic, CounselingCaseAnalysis]:
        # mutate — processing 행 선생성, 완성은 워커(mark_completed/failed)
        analysis = await self.repo.add(
            center_id=center_id,
            counseling_case_id=case_id,
            triggered_by=triggered_by,
        )

        # return
        return CaseAnalysisAtomic.started(
            analysis=analysis, member_id=member_id, session_take=session_take
        )
