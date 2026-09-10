from dataclasses import dataclass

from app.core.type import uuid_str

from .models import FormSignature
from .schemas import SignatureResponse


@dataclass(frozen=True, kw_only=True)
class SignatureAtomic:
    _act: str
    signature: FormSignature

    @classmethod
    def created(cls, *, signature: FormSignature) -> tuple["SignatureAtomic", FormSignature]:
        return cls(_act="created", signature=signature), signature

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "signature"

    def act_entity_id(self) -> uuid_str:
        return self.signature.id

    def payload(self) -> dict:
        dump = SignatureResponse.model_validate(self.signature).model_dump(mode="json")
        return {"data": dump}
