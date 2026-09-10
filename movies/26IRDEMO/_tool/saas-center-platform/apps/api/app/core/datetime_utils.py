from datetime import datetime, date, timedelta, timezone, time as dt_time

from app.core.exceptions import InvalidOperationException

KST = timezone(timedelta(hours=9))


def to_utc_naive(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None

    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    return dt


def kst_to_utc_naive(kst_date: date, kst_time: dt_time) -> datetime:
    kst_dt = datetime.combine(kst_date, kst_time, tzinfo=KST)
    return kst_dt.astimezone(timezone.utc).replace(tzinfo=None)


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    return to_utc_naive(dt)


def parse_date(
    value: str | None,
    field: str,
) -> date | None:
    """조회 파라미터의 날짜 문자열 → date. 잘못된 값은 4xx로 돌려준다.

    bare `date.fromisoformat`은 ValueError를 그대로 흘려 500이 된다 —
    클라이언트 입력 오류가 서버 장애로 기록되던 것을 막는다(실측: `?date_from=abc` → 500).
    """
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise InvalidOperationException(
            f"{field}: 날짜 형식이 아닙니다(YYYY-MM-DD) — {value!r}"
        ) from None


def coerce_date(
    value: str | date | datetime | None,
    field: str = "date",
) -> date | None:
    """str(YYYY-MM-DD...) / date / datetime / None 중 무엇이 와도 date로 정규화.

    Agent chain executor는 date 객체를, Tool 호출자는 문자열을 보낼 수 있어
    양쪽을 모두 받는 경계 지점에서 사용한다.
    """
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        raise InvalidOperationException(
            f"{field}: 날짜 형식이 아닙니다(YYYY-MM-DD) — {str(value)!r}"
        ) from None
