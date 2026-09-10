from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class UpdateCaseSetSummaryService:
    def __init__(
        self,
        repo: AssessmentCaseRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        set_summary: dict,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        case = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            set_summary=set_summary,
        )

        # return
        return AssessmentCaseAtomic.updated(
            case=case, changed={"set_summary": set_summary}
        )
