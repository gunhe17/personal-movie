from dataclasses import dataclass

from app.core.type import uuid_str

from .models import MemberWorkingTime


def _row(wt: MemberWorkingTime) -> dict:
    return {
        "weekday": wt.weekday,
        "start_time": wt.start_time.isoformat() if wt.start_time else None,
        "end_time": wt.end_time.isoformat() if wt.end_time else None,
        "break_start_time": wt.break_start_time.isoformat() if wt.break_start_time else None,
        "break_end_time": wt.break_end_time.isoformat() if wt.break_end_time else None,
    }


@dataclass(frozen=True, kw_only=True)
class MemberWorkingTimeAtomic:
    # 전건교체 = 멤버 근무시간 재구성 한 건의 사실(member_id가 대상, 7행은 payload).
    _member_id: str
    working_times: list[MemberWorkingTime]

    @classmethod
    def updated(
        cls,
        *,
        member_id: str,
        working_times: list[MemberWorkingTime],
    ) -> tuple["MemberWorkingTimeAtomic", list[MemberWorkingTime]]:
        return cls(_member_id=member_id, working_times=working_times), working_times

    def act(self) -> str:
        return "updated"

    def act_entity_name(self) -> str:
        return "member_working_time"

    def act_entity_id(self) -> uuid_str:
        return self._member_id

    def payload(self) -> dict:
        return {"data": {"working_times": [_row(wt) for wt in self.working_times]}}
