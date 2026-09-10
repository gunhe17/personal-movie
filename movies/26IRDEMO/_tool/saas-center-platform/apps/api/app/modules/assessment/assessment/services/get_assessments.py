from app.core.exceptions import EntityNotFoundException
from ..models import Assessment
from ..repository import AssessmentRepository


class GetAssessmentsService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(self, assessment_ids: list[str]) -> list[Assessment]:
        if not assessment_ids:
            return []

        # load
        assessments = await self.repo.list_by_ids(ids=assessment_ids)

        # verify
        found_ids = {a.id for a in assessments}
        missing_ids = set(assessment_ids) - found_ids
        if missing_ids:
            raise EntityNotFoundException(
                f"존재하지 않는 Assessment ID: {', '.join(missing_ids)}"
            )

        # return
        return assessments
