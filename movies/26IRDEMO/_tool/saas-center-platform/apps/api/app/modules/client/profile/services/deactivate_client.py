from app.core.exceptions import InvalidOperationException

from ..events import ClientAtomic
from ..repository import ClientRepository
from ..models import Client


class DeactivateClientService:
    def __init__(
        self,
        repo: ClientRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[ClientAtomic, Client]:
        # load
        client = await self.repo.get_in_center(center_id=center_id, client_id=client_id)

        # verify — 전이 규칙: active → inactive
        if client.status not in ("active",):
            raise InvalidOperationException(
                f"Invalid status transition: {client.status} → inactive. "
                "Allowed from: active"
            )

        # update
        client = await self.repo.update_in_place(id=client_id, status="inactive")
        assert client is not None
        return ClientAtomic.deactivated(client=client)
