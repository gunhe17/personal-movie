from datetime import date, time

from ..repository import MemberWorkingTimeRepository
from ._slots import WEEKDAYS, match_non_working


class GetWorkingStatusService:
    def __init__(
        self,
        repo: MemberWorkingTimeRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        member_id: str,
        target_date: date,
        slot: str,
        non_working_times: list,
    ) -> tuple[bool, str | None]:
        # load
        slot_time = time(int(slot[:2]), int(slot[3:]))
        working_time = await self.repo.find_by_weekday(
            member_id=member_id,
            weekday=WEEKDAYS[target_date.weekday()],
        )

        # return
        if not working_time or not working_time.start_time:
            return False, "비근무일"

        if slot_time < working_time.start_time or slot_time >= working_time.end_time:
            return False, "근무시간 외"

        if working_time.break_start_time and working_time.break_end_time:
            if (
                working_time.break_start_time <= slot_time
                and slot_time < working_time.break_end_time
            ):
                return False, "휴게시간"

        reason = match_non_working(slot_time, non_working_times)
        if reason:
            return False, reason

        return True, None
