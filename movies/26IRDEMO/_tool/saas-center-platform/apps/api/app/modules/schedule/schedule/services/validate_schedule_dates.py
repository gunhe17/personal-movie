from datetime import datetime, time as dt_time

from app.core.datetime_utils import kst_to_utc_naive

from ..repository import ScheduleRepository
from ..schemas import (
    ScheduleConflictDetail,
    ConflictingSchedule,
)

class ValidateScheduleDatesService:
    def __init__(self, repository: ScheduleRepository):
        self.repo = repository

    async def execute(
        self,
        center_id: str,
        dates: list[datetime],
        start_time: str,
        end_time: str,
        room_id: str,
        exclude_id: str | None = None,
        member_id: str | None = None,
        max_conflicts: int = 50,
    ) -> tuple[list[ScheduleConflictDetail], int]:
        sh, sm = map(int, start_time.split(":"))
        eh, em = map(int, end_time.split(":"))
        s_time = dt_time(sh, sm)
        e_time = dt_time(eh, em)

        conflicts: list[ScheduleConflictDetail] = []
        truncated_count = 0
        for idx, dt in enumerate(dates):
            session_number = idx + 1
            schedule_start = kst_to_utc_naive(dt.date(), s_time)
            schedule_end = kst_to_utc_naive(dt.date(), e_time)

            conflicting = await self.repo.list_conflicting(
                center_id=center_id,
                room_id=room_id,
                member_id=member_id,
                start=schedule_start,
                end=schedule_end,
                exclude_id=exclude_id,
            )

            if not conflicting:
                continue

            if len(conflicts) >= max_conflicts:
                truncated_count += 1
                continue

            conflicts.append(
                ScheduleConflictDetail(
                    session_number=session_number,
                    date=schedule_start,
                    conflicting_schedules=[
                        ConflictingSchedule.from_schedule(
                            s,
                            check_room_id=room_id,
                            check_member_id=member_id,
                        )
                        for s in conflicting
                    ],
                )
            )

        return conflicts, truncated_count
