from app.core.exceptions import InvalidOperationException

from ..events import ClientAtomic
from ..repository import ClientRepository
from ..models import Client


class ActivateClientService:
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

        # verify — 전이 규칙: inactive|archived → active(복원 포함)
        if client.status not in ("inactive", "archived"):
            raise InvalidOperationException(
                f"Invalid status transition: {client.status} → active. "
                "Allowed from: inactive, archived"
            )

        # update
        client = await self.repo.update_in_place(id=client_id, status="active")
        assert client is not None
        return ClientAtomic.activated(client=client)
