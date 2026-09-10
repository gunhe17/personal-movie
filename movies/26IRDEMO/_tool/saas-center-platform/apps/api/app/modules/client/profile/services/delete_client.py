from app.core.exceptions import InvalidOperationException
from ..models import Client
from ..events import ClientAtomic
from ..repository import ClientRepository
from ...client_relation.repository import ClientRelationRepository
from ...client_relation.services import ListPrimaryGuardianRelationsService


class DeleteClientService:
    def __init__(
        self,
        repo: ClientRepository,
        relation_repo: ClientRelationRepository | None = None,
    ):
        self.repo = repo
        self._relation_repo = relation_repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
    ) -> tuple[ClientAtomic, Client]:
        if self._relation_repo is not None:
            primary_relations = await ListPrimaryGuardianRelationsService(
                self._relation_repo
            ).execute(center_id, client_id)
            if primary_relations:
                child_ids = [rel.client_id for rel in primary_relations]
                raise InvalidOperationException(
                    "Cannot delete primary guardian. "
                    f"This guardian is the primary guardian for {len(child_ids)} child(ren). "
                    "Please assign another primary guardian first."
                )

        client = await self.repo.get_in_center(center_id=center_id, client_id=client_id)
        removed = await self.repo.remove_by_id(id=client_id)
        assert removed is not None
        return ClientAtomic.deleted(client=removed)
