from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Client
from .schemas import ClientResponse


@dataclass(frozen=True, kw_only=True)
class ClientAtomic:
    _act: str
    client: Client
    _changed: dict | None = None

    @classmethod
    def created(cls, *, client: Client) -> tuple["ClientAtomic", Client]:
        return cls(_act="created", client=client), client

    @classmethod
    def updated(cls, *, client: Client, changed: dict) -> tuple["ClientAtomic", Client]:
        return cls(_act="updated", client=client, _changed=changed), client

    @classmethod
    def activated(cls, *, client: Client) -> tuple["ClientAtomic", Client]:
        return cls(_act="activated", client=client), client

    @classmethod
    def deactivated(cls, *, client: Client) -> tuple["ClientAtomic", Client]:
        return cls(_act="deactivated", client=client), client

    @classmethod
    def archived(cls, *, client: Client) -> tuple["ClientAtomic", Client]:
        return cls(_act="archived", client=client), client

    @classmethod
    def deleted(cls, *, client: Client) -> tuple["ClientAtomic", Client]:
        return cls(_act="deleted", client=client), client

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "client"

    def act_entity_id(self) -> uuid_str:
        return self.client.id

    def payload(self) -> dict:
        dump = ClientResponse.model_validate(self.client).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
