from dataclasses import dataclass

from app.core.type import uuid_str

from .models import NonOperatingTime
from .schemas import NonOperatingTimeResponse


@dataclass(frozen=True, kw_only=True)
class NonOperatingTimeAtomic:
    _act: str
    non_op: NonOperatingTime
    _changed: dict | None = None

    @classmethod
    def created(cls, *, non_op: NonOperatingTime) -> tuple["NonOperatingTimeAtomic", NonOperatingTime]:
        return cls(_act="created", non_op=non_op), non_op

    @classmethod
    def updated(cls, *, non_op: NonOperatingTime, changed: dict) -> tuple["NonOperatingTimeAtomic", NonOperatingTime]:
        return cls(_act="updated", non_op=non_op, _changed=changed), non_op

    @classmethod
    def deleted(cls, *, non_op: NonOperatingTime) -> tuple["NonOperatingTimeAtomic", NonOperatingTime]:
        return cls(_act="deleted", non_op=non_op), non_op

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "non_operating_time"

    def act_entity_id(self) -> uuid_str:
        return self.non_op.id

    def payload(self) -> dict:
        dump = NonOperatingTimeResponse.model_validate(self.non_op).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
