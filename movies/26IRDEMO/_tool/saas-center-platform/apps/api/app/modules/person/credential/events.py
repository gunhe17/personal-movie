from dataclasses import dataclass

from app.core.type import uuid_str

from .models import PersonCredential
from .schemas import CredentialResponse


@dataclass(frozen=True, kw_only=True)
class CredentialAtomic:
    _act: str
    credential: PersonCredential
    _changed: dict | None = None

    @classmethod
    def created(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="created", credential=credential), credential

    @classmethod
    def updated(
        cls,
        *,
        credential: PersonCredential,
        changed: dict,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="updated", credential=credential, _changed=changed), credential

    @classmethod
    def deleted(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="deleted", credential=credential), credential

    @classmethod
    def approved(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="approved", credential=credential), credential

    @classmethod
    def rejected(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="rejected", credential=credential), credential

    @classmethod
    def verification_requested(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="verification_requested", credential=credential), credential

    @classmethod
    def attachment_uploaded(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="attachment_uploaded", credential=credential), credential

    @classmethod
    def attachment_removed(
        cls,
        *,
        credential: PersonCredential,
    ) -> tuple["CredentialAtomic", PersonCredential]:
        return cls(_act="attachment_removed", credential=credential), credential

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "person_credential"

    def act_entity_id(self) -> uuid_str:
        return self.credential.id

    def payload(self) -> dict:
        dump = CredentialResponse.from_orm_model(self.credential).model_dump(
            mode="json"
        )
        if self._act == "updated":
            return {"input": self._changed or {}, "result": dump}
        return {"data": dump}
