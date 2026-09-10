from app.modules.client.resource.events import ClientResourceAtomic
from app.modules.client.resource.models import ClientResource
from app.modules.client.resource.repository import ClientResourceRepository


class UnlinkResourceService:
    def __init__(
        self,
        repo: ClientResourceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        mapping_id: str,
        center_id: str,
    ) -> tuple[ClientResourceAtomic, ClientResource]:
        # load
        resource = await self.repo.get_in_center(
            mapping_id=mapping_id,
            center_id=center_id,
        )

        # remove
        await self.repo.hard_delete_by_id(mapping_id=mapping_id)

        # return
        return ClientResourceAtomic.unlinked(resource=resource)
