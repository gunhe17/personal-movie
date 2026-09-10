from app.core.exceptions import ConflictException
from app.modules.client.resource.events import ClientResourceAtomic
from app.modules.client.resource.models import ClientResource
from app.modules.client.resource.repository import ClientResourceRepository


class LinkResourceService:
    def __init__(
        self,
        repo: ClientResourceRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        client_id: str,
        resource_id: str,
        resource_type: str,
    ) -> tuple[ClientResourceAtomic, ClientResource]:
        # verify
        existing = await self.repo.find_by_client_and_resource(
            client_id=client_id,
            resource_id=resource_id,
        )
        if existing:
            raise ConflictException(
                f"Resource {resource_id} is already linked to client {client_id}"
            )

        # pre_admission은 client당 1건만 허용
        if resource_type == "pre_admission":
            existing_pre = await self.repo.list_by_client_and_type(
                center_id=center_id,
                client_id=client_id,
                resource_type="pre_admission",
            )
            if existing_pre:
                raise ConflictException(
                    "이미 사전기록지가 등록되어 있어요. 기존 기록지를 삭제한 후 다시 시도해주세요."
                )

        # mutate
        resource = await self.repo.add(
            center_id=center_id,
            client_id=client_id,
            resource_id=resource_id,
            resource_type=resource_type,
        )

        # return
        return ClientResourceAtomic.linked(resource=resource)
