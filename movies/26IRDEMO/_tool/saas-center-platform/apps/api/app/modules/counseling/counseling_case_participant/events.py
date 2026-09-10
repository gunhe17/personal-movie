from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingCaseParticipant
from .schemas import CounselingCaseParticipantResponse


@dataclass(frozen=True, kw_only=True)
class CaseParticipantAtomic:
    _act: str
    participant: CounselingCaseParticipant

    @classmethod
    def added(cls, *, participant: CounselingCaseParticipant) -> tuple["CaseParticipantAtomic", CounselingCaseParticipant]:
        return cls(_act="added", participant=participant), participant

    @classmethod
    def left(cls, *, participant: CounselingCaseParticipant) -> tuple["CaseParticipantAtomic", CounselingCaseParticipant]:
        return cls(_act="left", participant=participant), participant

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "counseling_case_participant"

    def act_entity_id(self) -> uuid_str:
        return self.participant.id

    def payload(self) -> dict:
        dump = CounselingCaseParticipantResponse.model_validate(self.participant).model_dump(mode="json")
        return {"data": dump}
