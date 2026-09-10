from datetime import datetime

from ..events import ScheduleAtomic
from ..models import Schedule
from ..repository import ScheduleRepository


class CreateScheduleService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        schedule_type: str,
        start: datetime,
        end: datetime,
        member_id: str | None = None,
        title: str | None = None,
        room_id: str | None = None,
        memo: str | None = None,
    ) -> tuple[ScheduleAtomic, Schedule]:
        # lock (room 직렬화만 — 충돌 조회는 handler가 별도 수행)
        if room_id:
            await self.repo.acquire_room_lock(center_id=center_id, room_id=room_id)

        # return
        schedule = await self.repo.add(
            center_id=center_id,
            schedule_type=schedule_type,
            start=start,
            end=end,
            member_id=member_id,
            title=title,
            room_id=room_id,
            memo=memo,
        )

        return ScheduleAtomic.created(schedule=schedule)
