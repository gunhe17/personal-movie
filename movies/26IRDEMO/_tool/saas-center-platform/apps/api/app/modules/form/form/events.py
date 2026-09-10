from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Form
from .schemas import FormResponse


@dataclass(frozen=True, kw_only=True)
class FormAtomic:
    _act: str
    form: Form

    @classmethod
    def created(cls, *, form: Form) -> tuple["FormAtomic", Form]:
        return cls(_act="created", form=form), form

    @classmethod
    def submitted(cls, *, form: Form) -> tuple["FormAtomic", Form]:
        return cls(_act="submitted", form=form), form

    @classmethod
    def reverted(cls, *, form: Form) -> tuple["FormAtomic", Form]:
        return cls(_act="reverted", form=form), form

    @classmethod
    def deleted(cls, *, form: Form) -> tuple["FormAtomic", Form]:
        return cls(_act="deleted", form=form), form

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "form"

    def act_entity_id(self) -> uuid_str:
        return self.form.id

    def payload(self) -> dict:
        dump = FormResponse.model_validate(self.form).model_dump(mode="json")
        return {"data": dump}
