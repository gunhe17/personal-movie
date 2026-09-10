from app.infrastructure.persistence.new_repository import Page

from ..repository import CounselingCaseRepository
from ..models import CounselingCase


class ListCounselingCasesService:
    def __init__(self, repo: CounselingCaseRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        counselor_id: str | None,
        status: str | None,
        page: int,
        size: int,
        program_ids: list[str] | None = None,
        case_ids: list[str] | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        keyword: str | None = None,
        case_code: str | None = None,
        total_sessions_min: int | None = None,
        total_sessions_max: int | None = None,
        sort: str = "desc",
    ) -> tuple[list[CounselingCase], Page]:
        return await self.repo.list_filtered_with_page(
            center_id=center_id,
            counselor_id=counselor_id,
            status=status,
            program_ids=program_ids,
            case_ids=case_ids,
            start_date=start_date,
            end_date=end_date,
            keyword=keyword,
            case_code=case_code,
            total_sessions_min=total_sessions_min,
            total_sessions_max=total_sessions_max,
            sort=sort,
            page=page,
            size=size,
        )
