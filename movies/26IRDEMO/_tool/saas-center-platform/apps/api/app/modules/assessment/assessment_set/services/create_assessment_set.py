from ..events import AssessmentSetAtomic
from ..repository import AssessmentSetRepository
from ..models import AssessmentSet


class CreateAssessmentSetService:
    def __init__(self, repo: AssessmentSetRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        name: str,
        description: str | None = None,
        assessment_summary: list[dict],
        center_member_summary: list[dict] | None = None,
    ) -> tuple[AssessmentSetAtomic, AssessmentSet]:
        # return
        assessment_set = await self.repo.add(
            center_id=center_id,
            name=name,
            assessment_summary=assessment_summary,
            description=description,
            center_member_summary=center_member_summary,
        )
        return AssessmentSetAtomic.created(assessment_set=assessment_set)
