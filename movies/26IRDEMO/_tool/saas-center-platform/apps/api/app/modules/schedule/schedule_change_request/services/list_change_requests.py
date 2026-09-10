from ..models import ScheduleChangeRequest
from ..repository import ScheduleChangeRequestRepository


class ListChangeRequestsService:
    def __init__(self, repo: ScheduleChangeRequestRepository):
        self.repo = repo

    async def execute(self, *, center_id: str, status: str | None = None) -> list[ScheduleChangeRequest]:
        return await self.repo.list_by_center(center_id=center_id, status=status)
