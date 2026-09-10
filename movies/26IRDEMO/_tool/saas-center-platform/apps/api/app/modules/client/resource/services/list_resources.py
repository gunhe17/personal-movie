from app.modules.client.resource.models import ClientResource
from app.modules.client.resource.repository import ClientResourceRepository


class ListResourcesService:
    def __init__(self, repo: ClientResourceRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
        resource_type: str | None = None,
        exclude_type: str | None = None,
    ) -> list[ClientResource]:
        # return
        return await self.repo.list_by_client_and_type(
            center_id=center_id,
            client_id=client_id,
            resource_type=resource_type,
            exclude_type=exclude_type,
        )
