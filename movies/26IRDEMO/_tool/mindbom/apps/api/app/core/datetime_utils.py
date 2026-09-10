"""Datetime 유틸리티 함수"""
from datetime import datetime, date, timedelta, timezone, time as dt_time

KST = timezone(timedelta(hours=9))


def to_utc_naive(dt: datetime | None) -> datetime | None:
    """Timezone-aware datetime → UTC naive"""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def kst_to_utc_naive(kst_date: date, kst_time: dt_time) -> datetime:
    """KST date + time → UTC naive datetime"""
    kst_dt = datetime.combine(kst_date, kst_time, tzinfo=KST)
    return kst_dt.astimezone(timezone.utc).replace(tzinfo=None)


def utc_now() -> datetime:
    """현재 시각 (UTC-naive)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_datetime(value: str | None) -> datetime | None:
    """ISO 8601 문자열 → UTC naive datetime"""
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    return to_utc_naive(dt)


def parse_date(value: str | None) -> date | None:
    """YYYY-MM-DD 문자열 → date"""
    if not value:
        return None
    return date.fromisoformat(value)
