from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentSessionParticipant
from .schemas import SessionParticipantResponse


@dataclass(frozen=True, kw_only=True)
class AssessmentSessionParticipantAtomic:
    _act: str
    participant: AssessmentSessionParticipant

    @classmethod
    def added(
        cls,
        *,
        participant: AssessmentSessionParticipant,
    ) -> tuple["AssessmentSessionParticipantAtomic", AssessmentSessionParticipant]:
        return cls(_act="added", participant=participant), participant

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_session_participant"

    def act_entity_id(self) -> uuid_str:
        return self.participant.id

    def payload(self) -> dict:
        return {
            "data": SessionParticipantResponse.model_validate(
                self.participant
            ).model_dump(mode="json")
        }
