from dataclasses import dataclass

from app.core.type import uuid_str

from .models import MessageTemplate
from .schemas import MessageTemplateResponse


@dataclass(frozen=True, kw_only=True)
class MessageTemplateAtomic:
    _act: str
    template: MessageTemplate
    _changed: dict | None = None

    @classmethod
    def created(cls, *, template: MessageTemplate) -> tuple["MessageTemplateAtomic", MessageTemplate]:
        return cls(_act="created", template=template), template

    @classmethod
    def updated(cls, *, template: MessageTemplate, changed: dict) -> tuple["MessageTemplateAtomic", MessageTemplate]:
        return cls(_act="updated", template=template, _changed=changed), template

    @classmethod
    def deleted(cls, *, template: MessageTemplate) -> tuple["MessageTemplateAtomic", MessageTemplate]:
        return cls(_act="deleted", template=template), template

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "message_template"

    def act_entity_id(self) -> uuid_str:
        return self.template.id

    def payload(self) -> dict:
        dump = MessageTemplateResponse.model_validate(self.template).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
