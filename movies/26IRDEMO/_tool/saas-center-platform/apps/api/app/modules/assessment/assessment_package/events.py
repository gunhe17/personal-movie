from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentPackage
from .schemas import AssessmentPackageResponse


@dataclass(frozen=True, kw_only=True)
class AssessmentPackageAtomic:
    _act: str
    assessment_package: AssessmentPackage
    _changed: dict | None = None

    @classmethod
    def created(cls, *, assessment_package: AssessmentPackage) -> tuple["AssessmentPackageAtomic", AssessmentPackage]:
        return cls(_act="created", assessment_package=assessment_package), assessment_package

    @classmethod
    def updated(cls, *, assessment_package: AssessmentPackage, changed: dict) -> tuple["AssessmentPackageAtomic", AssessmentPackage]:
        return cls(_act="updated", assessment_package=assessment_package, _changed=changed), assessment_package

    @classmethod
    def deleted(cls, *, assessment_package: AssessmentPackage) -> tuple["AssessmentPackageAtomic", AssessmentPackage]:
        return cls(_act="deleted", assessment_package=assessment_package), assessment_package

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_package"

    def act_entity_id(self) -> uuid_str:
        return self.assessment_package.id

    def payload(self) -> dict:
        dump = AssessmentPackageResponse.model_validate(self.assessment_package).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
