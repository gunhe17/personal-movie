from dataclasses import dataclass

from app.core.type import uuid_str

from .models import FieldNote
from .schemas import FieldNoteResponse


@dataclass(frozen=True, kw_only=True)
class FieldNoteAtomic:
    _act: str
    field_note: FieldNote
    _changed: dict | None = None

    @classmethod
    def created(cls, *, field_note: FieldNote) -> tuple["FieldNoteAtomic", FieldNote]:
        return cls(_act="created", field_note=field_note), field_note

    @classmethod
    def updated(cls, *, field_note: FieldNote, changed: dict) -> tuple["FieldNoteAtomic", FieldNote]:
        return cls(_act="updated", field_note=field_note, _changed=changed), field_note

    @classmethod
    def deleted(cls, *, field_note: FieldNote) -> tuple["FieldNoteAtomic", FieldNote]:
        return cls(_act="deleted", field_note=field_note), field_note

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "field_note"

    def act_entity_id(self) -> uuid_str:
        return self.field_note.id

    def payload(self) -> dict:
        dump = FieldNoteResponse.model_validate(self.field_note).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
