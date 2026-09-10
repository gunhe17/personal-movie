from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.voucher.client_voucher.models import ClientVoucher
from app.modules.voucher.client_voucher.repository import ClientVoucherRepository
from app.modules.voucher.client_voucher.services.get_client_voucher import (
    GetClientVoucherService,
)
from app.modules.voucher.client_voucher_resource.events import (
    ClientVoucherResourceAtomic,
)
from app.modules.voucher.client_voucher_resource.models import ClientVoucherResource
from app.modules.voucher.client_voucher_resource.repository import (
    ClientVoucherResourceRepository,
)
from app.modules.voucher.client_voucher_resource.schemas import (
    FORM_INSTANCE_RESOURCE_TYPE,
)
from app.modules.voucher.client_voucher_resource.services.link_resource import (
    LinkVoucherResourceService,
)
from app.modules.voucher.client_voucher_resource.services.list_resources import (
    ListVoucherResourcesService,
)
from app.modules.voucher.client_voucher_resource.services.unlink_resource import (
    UnlinkVoucherResourceService,
)


class ClientVoucherResourceFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _repo(self) -> ClientVoucherResourceRepository:
        return self._uow.repo(ClientVoucherResourceRepository)

    async def get_client_voucher(
        self,
        client_voucher_id: str,
        center_id: str,
    ) -> ClientVoucher:
        repo = self._uow.repo(ClientVoucherRepository)
        service = GetClientVoucherService(repo)
        return await service.execute(client_voucher_id, center_id)

    async def link_form_instance(
        self,
        center_id: str,
        client_voucher_id: str,
        instance_id: str,
    ) -> tuple[ClientVoucherResourceAtomic, ClientVoucherResource]:
        service = LinkVoucherResourceService(self._repo())
        return await service.execute(
            center_id, client_voucher_id, instance_id, FORM_INSTANCE_RESOURCE_TYPE
        )

    async def list_forms_by_voucher(
        self,
        center_id: str,
        client_voucher_id: str,
    ) -> list[ClientVoucherResource]:
        service = ListVoucherResourcesService(self._repo())
        return await service.execute(
            center_id, client_voucher_id, resource_type=FORM_INSTANCE_RESOURCE_TYPE
        )

    async def unlink_resource(
        self,
        mapping_id: str,
        center_id: str,
    ) -> tuple[ClientVoucherResourceAtomic, ClientVoucherResource]:
        service = UnlinkVoucherResourceService(self._repo())
        return await service.execute(mapping_id, center_id)
