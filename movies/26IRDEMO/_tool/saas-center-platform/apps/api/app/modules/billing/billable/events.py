from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Billable
from .schemas import BillableResponse


@dataclass(frozen=True, kw_only=True)
class BillableAtomic:
    _act: str
    billable: Billable
    _changed: dict | None = None

    @classmethod
    def created(cls, *, billable: Billable) -> tuple["BillableAtomic", Billable]:
        return cls(_act="created", billable=billable), billable

    @classmethod
    def updated(cls, *, billable: Billable, changed: dict) -> tuple["BillableAtomic", Billable]:
        return cls(_act="updated", billable=billable, _changed=changed), billable

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "billable"

    def act_entity_id(self) -> uuid_str:
        return self.billable.id

    def payload(self) -> dict:
        dump = BillableResponse.model_validate(self.billable).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
