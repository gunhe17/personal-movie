from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Document
from .schemas import DocumentResponse


@dataclass(frozen=True, kw_only=True)
class DocumentAtomic:
    _act: str
    document: Document
    _changed: dict | None = None

    @classmethod
    def created(
        cls,
        *,
        document: Document,
    ) -> tuple["DocumentAtomic", Document]:
        return cls(_act="created", document=document), document

    @classmethod
    def updated(cls, *, document: Document, changed: dict) -> tuple["DocumentAtomic", Document]:
        return cls(_act="updated", document=document, _changed=changed), document

    @classmethod
    def deleted(cls, *, document: Document) -> tuple["DocumentAtomic", Document]:
        return cls(_act="deleted", document=document), document

    @classmethod
    def restored(cls, *, document: Document) -> tuple["DocumentAtomic", Document]:
        return cls(_act="restored", document=document), document

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "document"

    def act_entity_id(self) -> uuid_str:
        return self.document.id

    def payload(self) -> dict:
        dump = DocumentResponse.model_validate(self.document).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
