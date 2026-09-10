from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Person
from .schemas import PersonResponse


@dataclass(frozen=True, kw_only=True)
class PersonAtomic:
    _act: str
    person: Person
    _changed: dict | None = None

    @classmethod
    def created(
        cls,
        *,
        person: Person,
    ) -> tuple["PersonAtomic", Person]:
        return cls(_act="created", person=person), person

    @classmethod
    def updated(
        cls,
        *,
        person: Person,
        changed: dict,
    ) -> tuple["PersonAtomic", Person]:
        return cls(_act="updated", person=person, _changed=changed), person

    @classmethod
    def deleted(
        cls,
        *,
        person: Person,
    ) -> tuple["PersonAtomic", Person]:
        return cls(_act="deleted", person=person), person

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "person"

    def act_entity_id(self) -> uuid_str:
        return self.person.id

    def payload(self) -> dict:
        dump = PersonResponse.model_validate(self.person).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed or {}, "result": dump}
        return {"data": dump}
