from app.core.exceptions import InvalidOperationException

from ..events import ClientAtomic
from ..repository import ClientRepository
from ..models import Client


class ArchiveClientService:
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

        # verify — 전이 규칙: inactive → archived
        if client.status not in ("inactive",):
            raise InvalidOperationException(
                f"Invalid status transition: {client.status} → archived. "
                "Allowed from: inactive"
            )

        # update
        client = await self.repo.update_in_place(id=client_id, status="archived")
        assert client is not None
        return ClientAtomic.archived(client=client)
