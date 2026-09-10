from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CenterAssessment
from .schemas import CenterAssessmentResponse


@dataclass(frozen=True, kw_only=True)
class CenterAssessmentAtomic:
    _act: str
    center_assessment: CenterAssessment
    _changed: dict | None = None

    @classmethod
    def created(
        cls, *, center_assessment: CenterAssessment
    ) -> tuple["CenterAssessmentAtomic", CenterAssessment]:
        return cls(
            _act="created", center_assessment=center_assessment
        ), center_assessment

    @classmethod
    def updated(
        cls, *, center_assessment: CenterAssessment, changed: dict
    ) -> tuple["CenterAssessmentAtomic", CenterAssessment]:
        return cls(
            _act="updated", center_assessment=center_assessment, _changed=changed
        ), center_assessment

    @classmethod
    def restored(
        cls, *, center_assessment: CenterAssessment
    ) -> tuple["CenterAssessmentAtomic", CenterAssessment]:
        return cls(
            _act="restored", center_assessment=center_assessment
        ), center_assessment

    @classmethod
    def deleted(
        cls, *, center_assessment: CenterAssessment
    ) -> tuple["CenterAssessmentAtomic", CenterAssessment]:
        return cls(
            _act="deleted", center_assessment=center_assessment
        ), center_assessment

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "center_assessment"

    def act_entity_id(self) -> uuid_str:
        return self.center_assessment.id

    def payload(self) -> dict:
        dump = CenterAssessmentResponse.model_validate(
            self.center_assessment
        ).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
