from datetime import time

from ..schemas import SLOT_MINUTES

WEEKDAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")


def generate_slots(
    start: time,
    end: time,
) -> list[str]:
    slots = []
    current = start

    while current < end:
        slots.append(f"{current.hour:02d}:{current.minute:02d}")
        minutes = current.hour * 60 + current.minute + SLOT_MINUTES
        current = time(minutes // 60, minutes % 60)

    return slots


def match_non_operating(
    slot_time: time,
    non_operating_times: list,
) -> str | None:
    for not_op in non_operating_times:
        if not_op.start_time is None and not_op.end_time is None:
            return not_op.reason
        elif not_op.start_time and not_op.end_time:
            if not_op.start_time <= slot_time < not_op.end_time:
                return not_op.reason
    return None
