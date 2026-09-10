from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentCase


@dataclass(frozen=True, kw_only=True)
class AssessmentCaseAtomic:
    _act: str
    case: AssessmentCase
    _changed: dict | None = None

    @classmethod
    def created(cls, *, case: AssessmentCase) -> tuple["AssessmentCaseAtomic", AssessmentCase]:
        return cls(_act="created", case=case), case

    @classmethod
    def updated(cls, *, case: AssessmentCase, changed: dict) -> tuple["AssessmentCaseAtomic", AssessmentCase]:
        return cls(_act="updated", case=case, _changed=changed), case

    @classmethod
    def completed(cls, *, case: AssessmentCase) -> tuple["AssessmentCaseAtomic", AssessmentCase]:
        return cls(_act="completed", case=case), case

    @classmethod
    def cancelled(cls, *, case: AssessmentCase) -> tuple["AssessmentCaseAtomic", AssessmentCase]:
        return cls(_act="cancelled", case=case), case

    @classmethod
    def cancel_reverted(cls, *, case: AssessmentCase) -> tuple["AssessmentCaseAtomic", AssessmentCase]:
        return cls(_act="cancel_reverted", case=case), case

    @classmethod
    def deleted(cls, *, case: AssessmentCase) -> tuple["AssessmentCaseAtomic", AssessmentCase]:
        return cls(_act="deleted", case=case), case

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_case"

    def act_entity_id(self) -> uuid_str:
        return self.case.id

    def payload(self) -> dict:
        data = {
            "id": self.case.id,
            "case_code": self.case.case_code,
            "counselor_id": self.case.counselor_id,
            "status": self.case.status,
            "updated_at": self.case.updated_at.isoformat() if self.case.updated_at else None,
        }
        if self._act == "updated":
            return {"input": self._changed or {}, "result": data}
        return {"data": data}
