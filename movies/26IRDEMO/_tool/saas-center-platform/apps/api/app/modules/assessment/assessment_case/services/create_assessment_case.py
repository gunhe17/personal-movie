from ..models import CaseStatus
from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class CreateAssessmentCaseService:
    def __init__(
        self,
        repo: AssessmentCaseRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_id: str,
        assessment_summary: list[dict],
        tags: list[str],
        is_final_report_required: bool,
        set_summary: dict | None = None,
        institution_summary: dict | None = None,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        # load
        case_code = await self.repo.next_case_code(center_id=center_id)

        # persist
        case = await self.repo.add(
            center_id=center_id,
            case_code=case_code,
            counselor_id=counselor_id,
            assessment_summary=assessment_summary,
            set_summary=set_summary,
            institution_summary=institution_summary,
            tags=tags,
            is_final_report_required=is_final_report_required,
            status=CaseStatus.PENDING,
        )

        # return
        return AssessmentCaseAtomic.created(case=case)
