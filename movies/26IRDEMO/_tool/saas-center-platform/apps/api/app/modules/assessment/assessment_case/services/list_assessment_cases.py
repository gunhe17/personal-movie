from datetime import date

from app.infrastructure.persistence.new_repository import Page

from ..repository import AssessmentCaseRepository
from ..models import AssessmentCase


class ListAssessmentCasesService:
    def __init__(self, repo: AssessmentCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        status: str | None = None,
        counselor_id: str | None = None,
        search: str | None = None,
        sort_order: str = "desc",
        has_institution: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        case_ids_filter: list[str] | None = None,
        tags: list[str] | None = None,
        report_required: bool | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        has_schedule: bool | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssessmentCase], Page]:
        return await self.repo.list_in_center_with_page(
            center_id=center_id,
            status=status,
            counselor_id=counselor_id,
            search=search,
            sort_order=sort_order,
            has_institution=has_institution,
            date_from=date_from,
            date_to=date_to,
            case_ids_filter=case_ids_filter,
            tags=tags,
            report_required=report_required,
            completed_from=completed_from,
            completed_to=completed_to,
            has_schedule=has_schedule,
            page=page,
            size=size,
        )
