from datetime import date

from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class ListAssessmentCasesByCounselorIdsService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_ids: list[str],
        status: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[AssessmentCase]:
        return await self.repo.list_by_counselor_ids(
            center_id=center_id,
            counselor_ids=counselor_ids,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )
