from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingNote
from .schemas import CounselingNoteResponse


def _strip_private(content: dict | None) -> dict | None:
    # private_notes는 작성자 전용 본문 — 감사 payload에서 제외(§10 민감값 금지)
    if not isinstance(content, dict):
        return content
    if "private_notes" not in content:
        return content
    masked = dict(content)
    masked.pop("private_notes", None)
    return masked


@dataclass(frozen=True, kw_only=True)
class CounselingNoteAtomic:
    _act: str
    note: CounselingNote
    _changed: dict | None = None

    @classmethod
    def created(cls, *, note: CounselingNote) -> tuple["CounselingNoteAtomic", CounselingNote]:
        return cls(_act="created", note=note), note

    @classmethod
    def updated(cls, *, note: CounselingNote, changed: dict) -> tuple["CounselingNoteAtomic", CounselingNote]:
        return cls(_act="updated", note=note, _changed=changed), note

    @classmethod
    def deleted(cls, *, note: CounselingNote) -> tuple["CounselingNoteAtomic", CounselingNote]:
        return cls(_act="deleted", note=note), note

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "counseling_note"

    def act_entity_id(self) -> uuid_str:
        return self.note.id

    def payload(self) -> dict:
        dump = CounselingNoteResponse.model_validate(self.note).model_dump(mode="json")
        dump["content"] = _strip_private(dump.get("content"))
        if self._act == "updated":
            changed = dict(self._changed or {})
            if "content" in changed:
                changed["content"] = _strip_private(changed["content"])
            return {"input": changed, "result": dump}
        return {"data": dump}
