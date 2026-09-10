from __future__ import annotations

from sqlalchemy.dialects.postgresql.ranges import Range


def to_range(pair: tuple[int, int] | None) -> Range[int] | None:
    """API 입력 tuple → Postgres Range. inclusive(`[low, high]`)로 저장."""
    if pair is None:
        return None
    low, high = pair
    return Range(low, high, bounds="[]")


def to_tuple(value: Range[int] | None) -> tuple[int, int] | None:
    """Postgres Range → API 출력 tuple. 경계는 inclusive 정규화."""
    if value is None:
        return None
    if value.isempty:
        return None

    low = value.lower
    high = value.upper
    if low is None or high is None:
        return None

    # 정규화: 입력이 `[low, high)` 형태면 high - 1로 보정
    if value.upper_inc is False:
        high = high - 1
    if value.lower_inc is False:
        low = low + 1
    return low, high
