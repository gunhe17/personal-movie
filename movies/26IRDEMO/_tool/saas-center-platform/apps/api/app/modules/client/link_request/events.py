from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ClientLinkRequest
from ..link.schemas import ClientLinkRequestResponse


@dataclass(frozen=True, kw_only=True)
class ClientLinkRequestAtomic:
    _act: str
    request: ClientLinkRequest

    @classmethod
    def created(cls, *, request: ClientLinkRequest) -> tuple["ClientLinkRequestAtomic", ClientLinkRequest]:
        return cls(_act="created", request=request), request

    @classmethod
    def approved(
        cls,
        *,
        request: ClientLinkRequest,
    ) -> tuple["ClientLinkRequestAtomic", ClientLinkRequest]:
        return cls(_act="approved", request=request), request

    @classmethod
    def rejected(
        cls,
        *,
        request: ClientLinkRequest,
    ) -> tuple["ClientLinkRequestAtomic", ClientLinkRequest]:
        return cls(_act="rejected", request=request), request

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "client_link_request"

    def act_entity_id(self) -> uuid_str:
        return self.request.id

    def payload(self) -> dict:
        dump = ClientLinkRequestResponse.model_validate(self.request).model_dump(mode="json")
        return {"data": dump}
