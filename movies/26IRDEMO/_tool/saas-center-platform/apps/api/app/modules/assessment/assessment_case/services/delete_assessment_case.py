from ..events import AssessmentCaseAtomic
from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class DeleteAssessmentCaseService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(self, center_id: str, case_id: str) -> tuple[AssessmentCaseAtomic, AssessmentCase]:
        # load (deleted_at IS NULL 자동 필터)
        await self.repo.get_in_center(center_id=center_id, case_id=case_id)

        # delete
        removed = await self.repo.remove_in_center(case_id=case_id, center_id=center_id)

        # return
        return AssessmentCaseAtomic.deleted(case=removed)
