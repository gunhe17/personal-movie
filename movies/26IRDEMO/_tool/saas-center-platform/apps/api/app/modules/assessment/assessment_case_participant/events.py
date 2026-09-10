from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentCaseParticipant


@dataclass(frozen=True, kw_only=True)
class AssessmentCaseParticipantAtomic:
    _act: str
    participant: AssessmentCaseParticipant

    @classmethod
    def added(
        cls,
        *,
        participant: AssessmentCaseParticipant,
    ) -> tuple["AssessmentCaseParticipantAtomic", AssessmentCaseParticipant]:
        return cls(_act="added", participant=participant), participant

    @classmethod
    def removed(
        cls,
        *,
        participant: AssessmentCaseParticipant,
    ) -> tuple["AssessmentCaseParticipantAtomic", AssessmentCaseParticipant]:
        return cls(_act="removed", participant=participant), participant

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_case_participant"

    def act_entity_id(self) -> uuid_str:
        return self.participant.id

    def payload(self) -> dict:
        return {
            "data": {
                "case_id": self.participant.case_id,
                "participant_type": self.participant.participant_type,
                "participant_id": self.participant.participant_id,
            }
        }
