from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingNoteShare
from .schemas import CounselingNoteShareResponse


@dataclass(frozen=True, kw_only=True)
class CounselingNoteShareAtomic:
    _act: str
    share: CounselingNoteShare
    _changed: dict | None = None

    @classmethod
    def created(cls, *, share: CounselingNoteShare) -> tuple["CounselingNoteShareAtomic", CounselingNoteShare]:
        return cls(_act="created", share=share), share

    @classmethod
    def updated(cls, *, share: CounselingNoteShare, changed: dict) -> tuple["CounselingNoteShareAtomic", CounselingNoteShare]:
        return cls(_act="updated", share=share, _changed=changed), share

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "counseling_note_share"

    def act_entity_id(self) -> uuid_str:
        return self.share.id

    def payload(self) -> dict:
        dump = CounselingNoteShareResponse.model_validate(self.share).model_dump(mode="json")
        if self._act == "updated":
            return {"input": dict(self._changed or {}), "result": dump}
        return {"data": dump}
