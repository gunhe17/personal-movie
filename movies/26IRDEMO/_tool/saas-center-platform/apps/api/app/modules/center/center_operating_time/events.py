from dataclasses import dataclass

from app.core.type import uuid_str

from .models import OperatingTime


def _row(ot: OperatingTime) -> dict:
    return {
        "weekday": ot.weekday,
        "open_time": ot.open_time.isoformat() if ot.open_time else None,
        "close_time": ot.close_time.isoformat() if ot.close_time else None,
        "break_start_time": ot.break_start_time.isoformat() if ot.break_start_time else None,
        "break_end_time": ot.break_end_time.isoformat() if ot.break_end_time else None,
    }


@dataclass(frozen=True, kw_only=True)
class OperatingTimeAtomic:
    # 전건교체 = 센터 운영시간 재구성 한 건의 사실(center_id가 대상, 7행은 payload).
    _center_id: str
    operating_times: list[OperatingTime]

    @classmethod
    def updated(
        cls,
        *,
        center_id: str,
        operating_times: list[OperatingTime],
    ) -> tuple["OperatingTimeAtomic", list[OperatingTime]]:
        return cls(_center_id=center_id, operating_times=operating_times), operating_times

    def act(self) -> str:
        return "updated"

    def act_entity_name(self) -> str:
        return "center_operating_time"

    def act_entity_id(self) -> uuid_str:
        return self._center_id

    def payload(self) -> dict:
        return {"data": {"operating_times": [_row(ot) for ot in self.operating_times]}}
