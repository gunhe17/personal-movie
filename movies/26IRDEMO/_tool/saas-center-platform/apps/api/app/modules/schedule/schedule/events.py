from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Schedule
from .schemas import ScheduleResponse


@dataclass(frozen=True, kw_only=True)
class ScheduleAtomic:
    _act: str
    schedule: Schedule
    _changed: dict | None = None

    @classmethod
    def created(cls, *, schedule: Schedule) -> tuple["ScheduleAtomic", Schedule]:
        return cls(_act="created", schedule=schedule), schedule

    @classmethod
    def updated(
        cls, *, schedule: Schedule, changed: dict
    ) -> tuple["ScheduleAtomic", Schedule]:
        return cls(_act="updated", schedule=schedule, _changed=changed), schedule

    @classmethod
    def deleted(cls, *, schedule: Schedule) -> tuple["ScheduleAtomic", Schedule]:
        return cls(_act="deleted", schedule=schedule), schedule

    @classmethod
    def restored(cls, *, schedule: Schedule) -> tuple["ScheduleAtomic", Schedule]:
        return cls(_act="restored", schedule=schedule), schedule

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "schedule"

    def act_entity_id(self) -> uuid_str:
        return self.schedule.id

    def payload(self) -> dict:
        dump = ScheduleResponse.model_validate(self.schedule).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
