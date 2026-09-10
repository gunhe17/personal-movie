import calendar
from datetime import datetime, timedelta, date, time as dt_time

from app.core.datetime_utils import kst_to_utc_naive
from ..repository import ScheduleRepository
from ..schemas import (
    BatchScheduleValidation,
    ScheduleConflictDetail,
    ConflictingSchedule,
)

WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


class ValidateRecurringSchedulesService:
    def __init__(self, repository: ScheduleRepository):
        self.repo = repository

    async def execute(
        self,
        center_id: str,
        data: BatchScheduleValidation,
        max_conflicts: int = 50,
    ) -> tuple[list[ScheduleConflictDetail], list[datetime], int]:
        # compute
        schedule_dates = self._calculate_schedule_dates(data)

        # load
        conflicts: list[ScheduleConflictDetail] = []
        truncated_count = 0
        for idx, schedule_datetime in enumerate(schedule_dates):
            session_number = idx + 1
            schedule_end = schedule_datetime + timedelta(minutes=data.duration_minutes)

            conflicting = await self.repo.list_conflicting(
                center_id=center_id,
                room_id=data.room_id,
                member_id=data.member_id,
                start=schedule_datetime,
                end=schedule_end,
            )

            if not conflicting:
                continue

            if len(conflicts) >= max_conflicts:
                truncated_count += 1
                continue

            conflicts.append(
                ScheduleConflictDetail(
                    session_number=session_number,
                    date=schedule_datetime,
                    conflicting_schedules=[
                        ConflictingSchedule.from_schedule(
                            s,
                            check_room_id=data.room_id,
                            check_member_id=data.member_id,
                        )
                        for s in conflicting
                    ],
                )
            )

        return conflicts, schedule_dates, truncated_count

    def _calculate_schedule_dates(
        self,
        data: BatchScheduleValidation,
    ) -> list[datetime]:
        recurrence = data.recurrence
        pattern = recurrence.pattern
        interval = recurrence.interval
        start_date = data.start_date
        until = recurrence.until
        max_count = recurrence.count if recurrence.count is not None else 365

        # 시간 파싱 (HH:MM)
        hour, minute = map(int, data.start_time.split(':'))
        schedule_time = dt_time(hour, minute)

        dates: list[datetime] = []

        if pattern == "daily":
            current = start_date
            while len(dates) < max_count:
                if until and current > until:
                    break
                dates.append(kst_to_utc_naive(current, schedule_time))
                current += timedelta(days=interval)

        elif pattern == "weekly":
            # days_of_week는 사용자가 KST 기준으로 선택한 요일
            # kst_to_utc_naive가 KST→UTC 변환을 처리하므로 요일 보정 불필요
            if recurrence.days_of_week:
                target_weekdays = sorted(
                    WEEKDAY_MAP[d]
                    for d in recurrence.days_of_week
                )
            else:
                target_weekdays = [start_date.weekday()]

            # 시작일이 속한 주의 월요일
            current_week_start = start_date - timedelta(days=start_date.weekday())

            while len(dates) < max_count:
                if until and current_week_start > until + timedelta(days=6):
                    break
                for wd in target_weekdays:
                    if len(dates) >= max_count:
                        break
                    candidate = current_week_start + timedelta(days=wd)
                    if candidate < start_date:
                        continue
                    if until and candidate > until:
                        continue
                    dates.append(kst_to_utc_naive(candidate, schedule_time))
                current_week_start += timedelta(weeks=interval)

        elif pattern == "monthly":
            repeat_types = recurrence.monthly_repeat_types or ["day"]
            base_day = start_date.day
            base_weekday = start_date.weekday()
            base_week_of_month = (start_date.day - 1) // 7 + 1
            month_offset = 0

            while len(dates) < max_count:
                # 연/월 계산
                total_months = (start_date.year * 12 + start_date.month - 1) + (month_offset * interval)
                year = total_months // 12
                month = total_months % 12 + 1

                # 안전장치: until을 크게 초과하면 종료
                if until and date(year, month, 1) > until + timedelta(days=31):
                    break

                for repeat_type in repeat_types:
                    if len(dates) >= max_count:
                        break

                    target_date = self._calculate_monthly_date(
                        year, month, repeat_type,
                        base_day, base_weekday, base_week_of_month,
                    )
                    if target_date is None:
                        continue
                    if until and target_date > until:
                        continue
                    dt = kst_to_utc_naive(target_date, schedule_time)
                    if dt not in dates:
                        dates.append(dt)

                month_offset += 1

        dates.sort()
        return dates

    @staticmethod
    def _calculate_monthly_date(
        year: int,
        month: int,
        repeat_type: str,
        base_day: int,
        base_weekday: int,
        base_week_of_month: int,
    ) -> date | None:
        if repeat_type == "day":
            # 같은 일자 (예: 28일)
            last_day = calendar.monthrange(year, month)[1]
            if base_day > last_day:
                return None  # 해당 월에 날짜 없음 (예: 2/31)
            return date(year, month, base_day)

        elif repeat_type == "weekday":
            # n번째 요일 (예: 4번째 수요일)
            return _get_nth_weekday_of_month(year, month, base_weekday, base_week_of_month)

        elif repeat_type == "last_weekday":
            # 마지막 요일 (예: 마지막 수요일)
            return _get_last_weekday_of_month(year, month, base_weekday)

        elif repeat_type == "last_day":
            # 마지막 날
            last_day = calendar.monthrange(year, month)[1]
            return date(year, month, last_day)

        return None


def _get_nth_weekday_of_month(year: int, month: int, weekday: int, nth: int) -> date | None:
    first_day = date(year, month, 1)
    first_weekday = first_day.weekday()
    diff = weekday - first_weekday
    if diff < 0:
        diff += 7
    target_day = 1 + diff + (nth - 1) * 7
    last_day = calendar.monthrange(year, month)[1]
    if target_day > last_day:
        return None  # n번째 요일이 해당 월에 없음
    return date(year, month, target_day)


def _get_last_weekday_of_month(year: int, month: int, weekday: int) -> date:
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    diff = last_day.weekday() - weekday
    if diff < 0:
        diff += 7
    return date(year, month, last_day.day - diff)
