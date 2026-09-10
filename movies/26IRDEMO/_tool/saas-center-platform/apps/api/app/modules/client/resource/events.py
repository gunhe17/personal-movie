from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ClientResource


@dataclass(frozen=True, kw_only=True)
class ClientResourceAtomic:
    _act: str
    resource: ClientResource

    @classmethod
    def linked(
        cls,
        *,
        resource: ClientResource,
    ) -> tuple["ClientResourceAtomic", ClientResource]:
        return cls(_act="linked", resource=resource), resource

    @classmethod
    def unlinked(
        cls,
        *,
        resource: ClientResource,
    ) -> tuple["ClientResourceAtomic", ClientResource]:
        return cls(_act="unlinked", resource=resource), resource

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "client_resource"

    def act_entity_id(self) -> uuid_str:
        return self.resource.id

    def payload(self) -> dict:
        return {
            "data": {
                "client_id": self.resource.client_id,
                "resource_id": self.resource.resource_id,
                "resource_type": self.resource.resource_type,
            }
        }
