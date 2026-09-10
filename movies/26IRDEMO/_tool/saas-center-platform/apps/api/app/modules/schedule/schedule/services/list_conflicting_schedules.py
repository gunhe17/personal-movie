from datetime import datetime

from ..models import Schedule
from ..repository import ScheduleRepository


class ListConflictingSchedulesService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        start: datetime,
        end: datetime,
        room_id: str | None = None,
        member_id: str | None = None,
        exclude_id: str | None = None,
    ) -> list[Schedule]:
        return await self.repo.list_conflicting(
            center_id=center_id,
            room_id=room_id,
            member_id=member_id,
            start=start,
            end=end,
            exclude_id=exclude_id,
        )
