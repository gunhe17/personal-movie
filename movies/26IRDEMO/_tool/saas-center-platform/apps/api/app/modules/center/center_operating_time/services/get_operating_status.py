from datetime import date, time

from ..repository import OperatingTimeRepository
from ._slots import WEEKDAYS, match_non_operating


class GetOperatingStatusService:
    def __init__(
        self,
        repo: OperatingTimeRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        target_date: date,
        slot: str,
        non_operating_times: list,
    ) -> tuple[bool, str | None]:
        # load
        slot_time = time(int(slot[:2]), int(slot[3:]))
        operating_time = await self.repo.find_by_weekday(
            center_id=center_id,
            weekday=WEEKDAYS[target_date.weekday()],
        )

        # return
        if not operating_time or not operating_time.open_time:
            return False, "휴무일"

        if slot_time < operating_time.open_time or slot_time >= operating_time.close_time:
            return False, "영업시간 외"

        if operating_time.break_start_time and operating_time.break_end_time:
            if (
                operating_time.break_start_time <= slot_time
                and slot_time < operating_time.break_end_time
            ):
                return False, "휴게시간"

        reason = match_non_operating(slot_time, non_operating_times)
        if reason:
            return False, reason

        return True, None
