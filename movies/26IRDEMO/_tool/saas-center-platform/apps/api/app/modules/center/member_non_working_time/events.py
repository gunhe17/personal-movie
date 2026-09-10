from dataclasses import dataclass

from app.core.type import uuid_str

from .models import MemberNonWorkingTime
from .schemas import MemberNonWorkingTimeResponse


@dataclass(frozen=True, kw_only=True)
class MemberNonWorkingTimeAtomic:
    _act: str
    non_working_time: MemberNonWorkingTime
    _changed: dict | None = None

    @classmethod
    def created(cls, *, non_working_time: MemberNonWorkingTime) -> tuple["MemberNonWorkingTimeAtomic", MemberNonWorkingTime]:
        return cls(_act="created", non_working_time=non_working_time), non_working_time

    @classmethod
    def updated(cls, *, non_working_time: MemberNonWorkingTime, changed: dict) -> tuple["MemberNonWorkingTimeAtomic", MemberNonWorkingTime]:
        return cls(_act="updated", non_working_time=non_working_time, _changed=changed), non_working_time

    @classmethod
    def deleted(cls, *, non_working_time: MemberNonWorkingTime) -> tuple["MemberNonWorkingTimeAtomic", MemberNonWorkingTime]:
        return cls(_act="deleted", non_working_time=non_working_time), non_working_time

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "member_non_working_time"

    def act_entity_id(self) -> uuid_str:
        return self.non_working_time.id

    def payload(self) -> dict:
        dump = MemberNonWorkingTimeResponse.model_validate(self.non_working_time).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
