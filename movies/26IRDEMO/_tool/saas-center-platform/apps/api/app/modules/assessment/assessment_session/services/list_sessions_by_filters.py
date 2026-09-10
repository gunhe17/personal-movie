from datetime import date

from ..repository import AssessmentSessionRepository
from ..models import AssessmentSession


class ListAssessmentSessionsByFiltersService:
    def __init__(self, repo: AssessmentSessionRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str | None = None,
        schedule_id: str | None = None,
        schedule_ids: list[str] | None = None,
        status: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[AssessmentSession]:
        return await self.repo.list_by_filters(
            center_id=center_id,
            case_id=case_id,
            schedule_id=schedule_id,
            schedule_ids=schedule_ids,
            status=status,
            date_from=date_from,
            date_to=date_to,
            offset=offset,
            limit=limit,
        )
