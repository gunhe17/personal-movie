from ..events import AssessmentSetAtomic
from ..repository import AssessmentSetRepository
from ..models import AssessmentSet


class DeleteAssessmentSetService:
    def __init__(self, repo: AssessmentSetRepository):
        self.repo = repo

    async def execute(self, center_id: str, set_id: str) -> tuple[AssessmentSetAtomic, AssessmentSet]:
        # verify
        assessment_set = await self.repo.get_in_center(center_id=center_id, set_id=set_id)

        # return
        removed = await self.repo.remove_in_center(set_id=set_id, center_id=center_id)

        return AssessmentSetAtomic.deleted(assessment_set=removed if removed is not None else assessment_set)
