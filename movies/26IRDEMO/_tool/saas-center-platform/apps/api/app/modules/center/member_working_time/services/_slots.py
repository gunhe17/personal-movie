from datetime import time

SLOT_MINUTES = 30

WEEKDAYS = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")

REASON_DISPLAY = {
    "ANNUAL_LEAVE": "연차",
    "HALF_DAY_AM": "반차(오전)",
    "HALF_DAY_PM": "반차(오후)",
    "SICK_LEAVE": "병가",
    "PERSONAL": "개인사유",
    "TRAINING": "교육",
    "BUSINESS_TRIP": "출장",
    "OTHER": "기타",
}


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


def match_non_working(
    slot_time: time,
    non_working_times: list,
) -> str | None:
    # 날짜 패턴은 이미 DB 쿼리에서 필터링됨. start_time·end_time 둘 다 null이면 종일
    for nwt in non_working_times:
        if nwt.start_time is None and nwt.end_time is None:
            return REASON_DISPLAY.get(nwt.reason, nwt.reason)
        elif nwt.start_time and nwt.end_time:
            if nwt.start_time <= slot_time < nwt.end_time:
                return REASON_DISPLAY.get(nwt.reason, nwt.reason)
    return None
