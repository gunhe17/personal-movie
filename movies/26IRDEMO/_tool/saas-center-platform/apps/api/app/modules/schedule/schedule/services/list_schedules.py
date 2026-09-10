from datetime import datetime

from ..models import Schedule
from ..repository import ScheduleRepository


class ListSchedulesService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        start: datetime,
        end: datetime,
        schedule_types: list[str] | None = None,
        member_ids: list[str] | None = None,
        room_id: str | None = None,
        title: str | None = None,
        memo: str | None = None,
    ) -> list[Schedule]:
        return await self.repo.list_filtered(
            center_id=center_id,
            start=start,
            end=end,
            schedule_types=schedule_types,
            member_ids=member_ids,
            room_id=room_id,
            title=title,
            memo=memo,
        )
