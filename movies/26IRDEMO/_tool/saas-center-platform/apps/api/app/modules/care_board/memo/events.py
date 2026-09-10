from dataclasses import dataclass
from datetime import date, datetime

from app.core.type import uuid_str

from .models import CareMemo
from .schemas import CareMemoResponse


@dataclass(frozen=True, kw_only=True)
class CareMemoAtomic:
    _act: str
    memo: CareMemo
    _changed: dict | None = None

    @classmethod
    def created(cls, *, memo: CareMemo) -> tuple["CareMemoAtomic", CareMemo]:
        return cls(_act="created", memo=memo), memo

    @classmethod
    def updated(cls, *, memo: CareMemo, changed: dict) -> tuple["CareMemoAtomic", CareMemo]:
        return cls(_act="updated", memo=memo, _changed=changed), memo

    @classmethod
    def deleted(cls, *, memo: CareMemo) -> tuple["CareMemoAtomic", CareMemo]:
        return cls(_act="deleted", memo=memo), memo

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "care_memo"

    def act_entity_id(self) -> uuid_str:
        return self.memo.id

    def payload(self) -> dict:
        dump = CareMemoResponse.model_validate(self.memo).model_dump(mode="json")
        if self._act == "updated":
            return {"input": _jsonable(self._changed), "result": dump}
        return {"data": dump}


def _jsonable(changed: dict | None) -> dict:
    # atomic payload는 JSONB다 — 서비스가 넘긴 델타에 datetime이 섞여 들어온다
    return {
        key: value.isoformat() if isinstance(value, (datetime, date)) else value
        for key, value in (changed or {}).items()
    }
