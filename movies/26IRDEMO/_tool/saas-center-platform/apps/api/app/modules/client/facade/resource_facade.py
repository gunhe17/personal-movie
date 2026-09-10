from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.repository import ClientRepository
from app.modules.client.profile.services.get_client import GetClientService
from app.modules.client.resource.events import ClientResourceAtomic
from app.modules.client.resource.models import ClientResource
from app.modules.client.resource.repository import ClientResourceRepository
from app.modules.client.resource.schemas import FORM_INSTANCE_RESOURCE_TYPE
from app.modules.client.resource.services.link_resource import LinkResourceService
from app.modules.client.resource.services.list_resources import ListResourcesService
from app.modules.client.resource.services.unlink_resource import UnlinkResourceService


class ResourceFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _verify_client_in_center(self, center_id: str, client_id: str) -> None:
        # client 가 호출자 센터 소유인지 확인(없으면/타센터면 404) — 타센터 client 링크 차단
        await GetClientService(self._uow.repo(ClientRepository)).execute(
            center_id, client_id
        )

    async def link_form_instance(
        self,
        center_id: str,
        client_id: str,
        instance_id: str,
    ) -> tuple[ClientResourceAtomic, ClientResource]:
        await self._verify_client_in_center(center_id, client_id)
        repo = self._uow.repo(ClientResourceRepository)
        service = LinkResourceService(repo)
        return await service.execute(
            center_id, client_id, instance_id, FORM_INSTANCE_RESOURCE_TYPE
        )

    async def list_forms_by_client(
        self,
        center_id: str,
        client_id: str,
    ) -> list[ClientResource]:
        repo = self._uow.repo(ClientResourceRepository)
        service = ListResourcesService(repo)
        return await service.execute(
            center_id, client_id, resource_type=FORM_INSTANCE_RESOURCE_TYPE
        )

    async def link_document(
        self,
        center_id: str,
        client_id: str,
        document_id: str,
        resource_type: str,
    ) -> tuple[ClientResourceAtomic, ClientResource]:
        await self._verify_client_in_center(center_id, client_id)
        repo = self._uow.repo(ClientResourceRepository)
        service = LinkResourceService(repo)
        return await service.execute(
            center_id, client_id, document_id, resource_type
        )

    async def list_documents_by_client(
        self,
        center_id: str,
        client_id: str,
        resource_type: str | None = None,
    ) -> list[ClientResource]:
        repo = self._uow.repo(ClientResourceRepository)
        service = ListResourcesService(repo)
        if resource_type:
            return await service.execute(
                center_id, client_id, resource_type=resource_type
            )
        else:
            return await service.execute(
                center_id, client_id, exclude_type=FORM_INSTANCE_RESOURCE_TYPE
            )

    async def unlink_resource(
        self,
        mapping_id: str,
        center_id: str,
    ) -> tuple[ClientResourceAtomic, ClientResource]:
        repo = self._uow.repo(ClientResourceRepository)
        service = UnlinkResourceService(repo)
        return await service.execute(mapping_id, center_id)
