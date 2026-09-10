from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Center
from .schemas import CenterResponse


@dataclass(frozen=True, kw_only=True)
class CenterAtomic:
    _act: str
    center: Center
    _changed: dict | None = None

    @classmethod
    def created(cls, *, center: Center) -> tuple["CenterAtomic", Center]:
        return cls(_act="created", center=center), center

    @classmethod
    def updated(cls, *, center: Center, changed: dict) -> tuple["CenterAtomic", Center]:
        return cls(_act="updated", center=center, _changed=changed), center

    @classmethod
    def activated(cls, *, center: Center) -> tuple["CenterAtomic", Center]:
        return cls(_act="activated", center=center), center

    @classmethod
    def suspended(cls, *, center: Center) -> tuple["CenterAtomic", Center]:
        return cls(_act="suspended", center=center), center

    @classmethod
    def restored(cls, *, center: Center) -> tuple["CenterAtomic", Center]:
        return cls(_act="restored", center=center), center

    @classmethod
    def terminated(cls, *, center: Center) -> tuple["CenterAtomic", Center]:
        return cls(_act="terminated", center=center), center

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "center"

    def act_entity_id(self) -> uuid_str:
        return self.center.id

    def payload(self) -> dict:
        dump = CenterResponse.model_validate(self.center).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
