from datetime import datetime

from app.infrastructure.persistence.new_repository import Page

from ..repository import AssessmentPackageRepository
from ..models import AssessmentPackage


class ListAssessmentPackagesService:
    def __init__(self, repo: AssessmentPackageRepository):
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
    ) -> tuple[list[AssessmentPackage], Page]:
        return await self.repo.list_in_center_with_page(
            center_id=center_id, page=page, size=size,
            search=search, assessment_type=assessment_type,
            created_from=created_from, created_to=created_to,
        )
