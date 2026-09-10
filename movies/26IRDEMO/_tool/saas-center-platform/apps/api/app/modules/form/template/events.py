from dataclasses import dataclass

from app.core.type import uuid_str

from .models import FormTemplate
from .schemas import TemplateResponse


@dataclass(frozen=True, kw_only=True)
class FormTemplateAtomic:
    _act: str
    _entity_name: str
    template: FormTemplate
    _changed: dict | None = None

    @classmethod
    def created(cls, *, template: FormTemplate) -> tuple["FormTemplateAtomic", FormTemplate]:
        return cls(_act="created", _entity_name="form_template", template=template), template

    @classmethod
    def version_created(cls, *, template: FormTemplate) -> tuple["FormTemplateAtomic", FormTemplate]:
        return cls(_act="created", _entity_name="form_template_version", template=template), template

    @classmethod
    def updated(cls, *, template: FormTemplate, changed: dict) -> tuple["FormTemplateAtomic", FormTemplate]:
        return cls(_act="updated", _entity_name="form_template", template=template, _changed=changed), template

    @classmethod
    def deactivated(cls, *, template: FormTemplate) -> tuple["FormTemplateAtomic", FormTemplate]:
        return cls(_act="deactivated", _entity_name="form_template", template=template), template

    @classmethod
    def reactivated(cls, *, template: FormTemplate) -> tuple["FormTemplateAtomic", FormTemplate]:
        return cls(_act="reactivated", _entity_name="form_template", template=template), template

    @classmethod
    def cloned(cls, *, template: FormTemplate) -> tuple["FormTemplateAtomic", FormTemplate]:
        return cls(_act="cloned", _entity_name="form_template", template=template), template

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return self._entity_name

    def act_entity_id(self) -> uuid_str:
        return self.template.id

    def payload(self) -> dict:
        dump = TemplateResponse.model_validate(self.template).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
