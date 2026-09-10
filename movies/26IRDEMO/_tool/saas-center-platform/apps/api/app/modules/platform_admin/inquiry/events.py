from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Inquiry


@dataclass(frozen=True, kw_only=True)
class InquiryAtomic:
    _act: str
    inquiry: Inquiry

    @classmethod
    def created(cls, *, inquiry: Inquiry) -> tuple["InquiryAtomic", Inquiry]:
        return cls(_act="created", inquiry=inquiry), inquiry

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "inquiry"

    def act_entity_id(self) -> uuid_str:
        return self.inquiry.id

    def payload(self) -> dict:
        return {"data": {"id": self.inquiry.id, "subject": self.inquiry.subject}}
