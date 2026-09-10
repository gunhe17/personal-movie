from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class UpdateCaseCounselorService:
    def __init__(
        self,
        repo: AssessmentCaseRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        new_counselor_id: str,
    ) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        case = await self.repo.update_in_center(
            case_id=case_id,
            center_id=center_id,
            counselor_id=new_counselor_id,
        )

        # return
        return AssessmentCaseAtomic.updated(
            case=case, changed={"counselor_id": new_counselor_id}
        )
