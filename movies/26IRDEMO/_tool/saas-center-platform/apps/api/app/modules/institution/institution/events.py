from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Institution
from .schemas import InstitutionResponse


@dataclass(frozen=True, kw_only=True)
class InstitutionAtomic:
    _act: str
    institution: Institution
    _changed: dict | None = None

    @classmethod
    def created(
        cls,
        *,
        institution: Institution,
    ) -> tuple["InstitutionAtomic", Institution]:
        return cls(_act="created", institution=institution), institution

    @classmethod
    def updated(
        cls,
        *,
        institution: Institution,
        changed: dict,
    ) -> tuple["InstitutionAtomic", Institution]:
        return cls(_act="updated", institution=institution, _changed=changed), institution

    @classmethod
    def deleted(
        cls,
        *,
        institution: Institution,
    ) -> tuple["InstitutionAtomic", Institution]:
        return cls(_act="deleted", institution=institution), institution

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "institution"

    def act_entity_id(self) -> uuid_str:
        return self.institution.id

    def payload(self) -> dict:
        dump = InstitutionResponse.model_validate(self.institution).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
