from ..events import CaseAnalysisAtomic
from ..models import CounselingCaseAnalysis
from ..repository import CounselingCaseAnalysisRepository


class MarkAnalysisCompletedService:
    def __init__(self, repo: CounselingCaseAnalysisRepository):
        self.repo = repo

    async def execute(
        self,
        analysis_id: str,
        *,
        content: dict,
        session_count: int,
        model_used: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
    ) -> tuple[CaseAnalysisAtomic, CounselingCaseAnalysis]:
        # save
        updated = await self.repo.update_in_place(
            analysis_id,
            status="completed",
            content=content,
            session_count=session_count,
            model_used=model_used,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

        # return
        return CaseAnalysisAtomic.completed(analysis=updated)
