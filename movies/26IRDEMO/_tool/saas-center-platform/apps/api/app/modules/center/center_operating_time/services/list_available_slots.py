from datetime import date, time

from ..repository import OperatingTimeRepository
from ._slots import WEEKDAYS, generate_slots, match_non_operating


class ListAvailableSlotsService:
    def __init__(
        self,
        repo: OperatingTimeRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        target_date: date,
        non_operating_times: list,
    ) -> list[str]:
        # load
        operating_time = await self.repo.find_by_weekday(
            center_id=center_id,
            weekday=WEEKDAYS[target_date.weekday()],
        )
        if not operating_time or not operating_time.open_time:
            return []

        # compute
        all_slots = generate_slots(operating_time.open_time, operating_time.close_time)

        if operating_time.break_start_time and operating_time.break_end_time:
            break_slots = set(
                generate_slots(
                    operating_time.break_start_time, operating_time.break_end_time
                )
            )
            all_slots = [s for s in all_slots if s not in break_slots]

        # return
        available_slots = []
        for slot in all_slots:
            slot_time = time(int(slot[:2]), int(slot[3:]))
            if match_non_operating(slot_time, non_operating_times) is None:
                available_slots.append(slot)

        return available_slots
