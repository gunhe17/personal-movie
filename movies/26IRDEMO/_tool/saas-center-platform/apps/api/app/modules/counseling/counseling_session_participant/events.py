from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingSessionParticipant
from .schemas import SessionParticipantResponse


@dataclass(frozen=True, kw_only=True)
class SessionParticipantAtomic:
    _act: str
    participant: CounselingSessionParticipant
    _changed: dict | None = None

    @classmethod
    def updated(cls, *, participant: CounselingSessionParticipant, changed: dict) -> tuple["SessionParticipantAtomic", CounselingSessionParticipant]:
        return cls(_act="updated", participant=participant, _changed=changed), participant

    @classmethod
    def added(cls, *, participant: CounselingSessionParticipant) -> tuple["SessionParticipantAtomic", CounselingSessionParticipant]:
        return cls(_act="added", participant=participant), participant

    @classmethod
    def removed(cls, *, participant: CounselingSessionParticipant) -> tuple["SessionParticipantAtomic", CounselingSessionParticipant]:
        return cls(_act="removed", participant=participant), participant

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "session_participant"

    def act_entity_id(self) -> uuid_str:
        return self.participant.id

    def payload(self) -> dict:
        dump = SessionParticipantResponse.model_validate(self.participant).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
