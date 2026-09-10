from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CenterApplication
from .schemas import CenterApplicationResponse


@dataclass(frozen=True, kw_only=True)
class CenterApplicationAtomic:
    _act: str
    application: CenterApplication

    @classmethod
    def created(
        cls,
        *,
        application: CenterApplication,
    ) -> tuple["CenterApplicationAtomic", CenterApplication]:
        return cls(_act="created", application=application), application

    @classmethod
    def cancelled(
        cls,
        *,
        application: CenterApplication,
    ) -> tuple["CenterApplicationAtomic", CenterApplication]:
        return cls(_act="cancelled", application=application), application

    @classmethod
    def approved(
        cls,
        *,
        application: CenterApplication,
    ) -> tuple["CenterApplicationAtomic", CenterApplication]:
        return cls(_act="approved", application=application), application

    @classmethod
    def rejected(
        cls,
        *,
        application: CenterApplication,
    ) -> tuple["CenterApplicationAtomic", CenterApplication]:
        return cls(_act="rejected", application=application), application

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "center_application"

    def act_entity_id(self) -> uuid_str:
        return self.application.id

    def payload(self) -> dict:
        dump = CenterApplicationResponse.model_validate(self.application).model_dump(mode="json")
        return {"data": dump}
