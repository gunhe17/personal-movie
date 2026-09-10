from dataclasses import dataclass
from datetime import date, datetime

from app.core.type import uuid_str

from .models import CareBoardEntry
from .schemas import CareBoardEntryResponse


@dataclass(frozen=True, kw_only=True)
class CareBoardEntryAtomic:
    _act: str
    entry: CareBoardEntry
    _changed: dict | None = None

    @classmethod
    def created(cls, *, entry: CareBoardEntry) -> tuple["CareBoardEntryAtomic", CareBoardEntry]:
        return cls(_act="created", entry=entry), entry

    @classmethod
    def updated(cls, *, entry: CareBoardEntry, changed: dict) -> tuple["CareBoardEntryAtomic", CareBoardEntry]:
        return cls(_act="updated", entry=entry, _changed=changed), entry

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "care_board_entry"

    def act_entity_id(self) -> uuid_str:
        return self.entry.id

    def payload(self) -> dict:
        dump = CareBoardEntryResponse.model_validate(self.entry).model_dump(mode="json")
        if self._act == "updated":
            return {"input": _jsonable(self._changed), "result": dump}
        return {"data": dump}


def _jsonable(changed: dict | None) -> dict:
    # atomic payload는 JSONB다 — 서비스가 넘긴 델타에 datetime이 섞여 들어온다
    return {
        key: value.isoformat() if isinstance(value, (datetime, date)) else value
        for key, value in (changed or {}).items()
    }
