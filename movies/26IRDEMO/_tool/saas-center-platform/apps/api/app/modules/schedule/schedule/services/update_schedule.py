from datetime import datetime

from app.core.type import unset

from ..events import ScheduleAtomic
from ..models import Schedule
from ..repository import ScheduleRepository


class UpdateScheduleService:
    def __init__(self, repo: ScheduleRepository):
        self.repo = repo

    async def execute(
        self,
        schedule_id: str,
        center_id: str,
        *,
        member_id: str | None = unset,
        title: str | None = unset,
        room_id: str | None = unset,
        start: datetime = unset,
        end: datetime = unset,
        memo: str | None = unset,
        changed: dict | None = None,
    ) -> tuple[ScheduleAtomic, Schedule]:
        # load
        schedule = await self.repo.get_in_center(id=schedule_id, center_id=center_id)

        # lock (room 직렬화만 — 충돌 조회는 handler가 별도 수행)
        if room_id is not unset or start is not unset or end is not unset:
            check_room_id = room_id if room_id is not unset else schedule.room_id
            if check_room_id:
                await self.repo.acquire_room_lock(
                    center_id=center_id,
                    room_id=check_room_id,
                )

        # update (전 필드 unset이면 no-op)
        if all(v is unset for v in (member_id, title, room_id, start, end, memo)):
            return ScheduleAtomic.updated(schedule=schedule, changed=changed or {})

        updated_schedule = await self.repo.update_in_center(
            id=schedule_id,
            center_id=center_id,
            member_id=member_id,
            title=title,
            room_id=room_id,
            start=start,
            end=end,
            memo=memo,
        )
        return ScheduleAtomic.updated(schedule=updated_schedule, changed=changed or {})
