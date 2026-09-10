from ..repository import AssessmentRepository
from ..models import Assessment


class ListAssessmentsService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        status: str | None,
        page: int,
        size: int,
    ) -> tuple[list[Assessment], int]:
        if status:
            items, meta = await self.repo.list_by_status_with_page(
                status=status,
                page=page,
                size=size,
            )
        else:
            items, meta = await self.repo.list_all_with_page(page=page, size=size)

        return items, meta["total"]
