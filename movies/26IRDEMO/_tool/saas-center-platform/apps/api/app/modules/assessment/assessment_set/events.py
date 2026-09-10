from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentSet
from .schemas import AssessmentSetResponse


@dataclass(frozen=True, kw_only=True)
class AssessmentSetAtomic:
    _act: str
    assessment_set: AssessmentSet
    _changed: dict | None = None

    @classmethod
    def created(cls, *, assessment_set: AssessmentSet) -> tuple["AssessmentSetAtomic", AssessmentSet]:
        return cls(_act="created", assessment_set=assessment_set), assessment_set

    @classmethod
    def updated(cls, *, assessment_set: AssessmentSet, changed: dict) -> tuple["AssessmentSetAtomic", AssessmentSet]:
        return cls(_act="updated", assessment_set=assessment_set, _changed=changed), assessment_set

    @classmethod
    def deleted(cls, *, assessment_set: AssessmentSet) -> tuple["AssessmentSetAtomic", AssessmentSet]:
        return cls(_act="deleted", assessment_set=assessment_set), assessment_set

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_set"

    def act_entity_id(self) -> uuid_str:
        return self.assessment_set.id

    def payload(self) -> dict:
        dump = AssessmentSetResponse.model_validate(self.assessment_set).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
