from datetime import datetime

from app.infrastructure.persistence.new_repository import Page

from ..repository import AssessmentSetRepository
from ..models import AssessmentSet


class ListAssessmentSetsService:
    def __init__(self, repo: AssessmentSetRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        page: int,
        size: int,
        search: str | None = None,
        assessment_type: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[AssessmentSet], Page]:
        return await self.repo.list_in_center_with_page(
            center_id=center_id, page=page, size=size,
            search=search, assessment_type=assessment_type,
            created_from=created_from, created_to=created_to,
        )
