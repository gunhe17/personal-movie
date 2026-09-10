from ..models import CenterApplication
from ..repository import CenterApplicationRepository


class ListApplicationsService:
    def __init__(self, repo: CenterApplicationRepository):
        self.repo = repo

    async def execute(
        self,
        status_filter: str | None,
        skip: int,
        limit: int,
    ) -> tuple[list[CenterApplication], int]:
        # query
        if status_filter == "PENDING":
            applications = await self.repo.list_pending(skip=skip, limit=limit)
            total = await self.repo.count_pending()
        else:
            applications = await self.repo.list_with_filter(
                status=status_filter,
                skip=skip,
                limit=limit,
            )
            total = await self.repo.count_with_filter(status=status_filter)

        # return
        return applications, total
