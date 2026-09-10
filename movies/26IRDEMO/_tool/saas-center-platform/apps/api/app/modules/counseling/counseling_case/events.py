from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingCase
from .schemas import CounselingCaseResponse


@dataclass(frozen=True, kw_only=True)
class CounselingCaseAtomic:
    _act: str
    case: CounselingCase
    _changed: dict | None = None

    @classmethod
    def created(
        cls, *, case: CounselingCase
    ) -> tuple["CounselingCaseAtomic", CounselingCase]:
        return cls(_act="created", case=case), case

    @classmethod
    def updated(
        cls, *, case: CounselingCase, changed: dict
    ) -> tuple["CounselingCaseAtomic", CounselingCase]:
        return cls(_act="updated", case=case, _changed=changed), case

    @classmethod
    def deleted(
        cls, *, case: CounselingCase
    ) -> tuple["CounselingCaseAtomic", CounselingCase]:
        return cls(_act="deleted", case=case), case

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "counseling_case"

    def act_entity_id(self) -> uuid_str:
        return self.case.id

    def payload(self) -> dict:
        dump = CounselingCaseResponse.model_validate(self.case).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
