from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class GetTaskByCaseAssessmentService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        case_id: str,
        assessment_id: str,
    ) -> AssessmentTask:
        # return
        return await self.repo.get_by_case_assessment(
            case_id=case_id,
            assessment_id=assessment_id,
        )
