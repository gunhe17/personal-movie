from datetime import date, time

from ..repository import MemberWorkingTimeRepository
from ._slots import WEEKDAYS, generate_slots, match_non_working


class ListAvailableSlotsService:
    def __init__(
        self,
        repo: MemberWorkingTimeRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        member_id: str,
        target_date: date,
        non_working_times: list,
    ) -> list[str]:
        # load
        working_time = await self.repo.find_by_weekday(
            member_id=member_id,
            weekday=WEEKDAYS[target_date.weekday()],
        )
        if not working_time or not working_time.start_time:
            return []

        # compute
        all_slots = generate_slots(working_time.start_time, working_time.end_time)

        if working_time.break_start_time and working_time.break_end_time:
            break_slots = set(
                generate_slots(
                    working_time.break_start_time, working_time.break_end_time
                )
            )
            all_slots = [s for s in all_slots if s not in break_slots]

        # return
        available_slots = []
        for slot in all_slots:
            slot_time = time(int(slot[:2]), int(slot[3:]))
            if match_non_working(slot_time, non_working_times) is None:
                available_slots.append(slot)

        return available_slots
